"""Tests for Oracle V2 legacy-compatible price feed methods."""
from pathlib import Path
import pytest

CONTRACT = str(Path(__file__).resolve().parents[1] / "contracts" / "oracle_v2.py")
GEN = 10 ** 18


def _post(oracle, vm, who, asset="BTC", url="https://example.com/btc", price="67500", tol=5, bond=1):
    vm.sender = who
    vm.value = bond * GEN
    fid = oracle.post_price(asset, url, price, tol)
    vm.value = 0
    return fid


def test_post_price(deploy, direct_vm, direct_alice):
    oracle = deploy(CONTRACT)
    fid = _post(oracle, direct_vm, direct_alice)
    assert fid == 0
    assert oracle.get_feed_count() == 1
    f = oracle.get_feed(0)
    assert f["asset"] == "BTC"
    assert f["claimed_price"] == "67500"
    assert f["status"] == 0  # POSTED
    assert int(f["bond"]) == GEN


def test_post_requires_bond(deploy, direct_vm, direct_alice):
    oracle = deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("bond_required"):
        oracle.post_price("ETH", "https://example.com", "3500", 5)


def test_post_requires_asset(deploy, direct_vm, direct_alice):
    oracle = deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("empty_asset"):
        oracle.post_price("", "https://example.com", "100", 5)
    direct_vm.value = 0


def test_tolerance_bounds(deploy, direct_vm, direct_alice):
    oracle = deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("bad_tolerance"):
        oracle.post_price("GOLD", "https://example.com", "2000", 0)
    with direct_vm.expect_revert("bad_tolerance"):
        oracle.post_price("GOLD", "https://example.com", "2000", 51)
    direct_vm.value = 0


def test_challenge(deploy, direct_vm, direct_alice, direct_bob):
    oracle = deploy(CONTRACT)
    _post(oracle, direct_vm, direct_alice, bond=2)
    direct_vm.sender = direct_bob
    direct_vm.value = 2 * GEN
    oracle.challenge(0)
    direct_vm.value = 0
    f = oracle.get_feed(0)
    assert f["status"] == 2  # DISPUTED


def test_challenge_must_match_bond(deploy, direct_vm, direct_alice, direct_bob):
    oracle = deploy(CONTRACT)
    _post(oracle, direct_vm, direct_alice, bond=2)
    direct_vm.sender = direct_bob
    direct_vm.value = 1 * GEN
    with direct_vm.expect_revert("counter_bond_must_match"):
        oracle.challenge(0)
    direct_vm.value = 0


def test_multiple_feeds(deploy, direct_vm, direct_alice):
    oracle = deploy(CONTRACT)
    _post(oracle, direct_vm, direct_alice, asset="BTC", price="67000", tol=5)
    _post(oracle, direct_vm, direct_alice, asset="ETH", price="3500", tol=3)
    _post(oracle, direct_vm, direct_alice, asset="GOLD", price="2050", tol=2)
    assert oracle.get_feed_count() == 3
    assert oracle.get_feed(1)["asset"] == "ETH"
    assert oracle.get_feed(2)["tolerance_pct"] == 2
