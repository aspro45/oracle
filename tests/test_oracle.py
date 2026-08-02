"""Executable Oracle V2 canonical-feed, dispute, bond, and payout tests."""

import hashlib
import json
from pathlib import Path


CONTRACT = str(Path(__file__).resolve().parents[1] / "contracts" / "oracle_v2.py")
GEN = 10**18


def _deploy_feed(deploy, vm, owner):
    vm.warp("2026-07-16T12:00:00Z")
    vm.sender = owner
    contract = deploy(CONTRACT)
    vm.value = GEN
    feed_id = contract.post_price("ETH", "https://example.com/price", "3000", 5)
    vm.value = 0
    return contract, int(feed_id)


def _mock_price(vm, price="3020"):
    vm.mock_llm(
        r"extracting a price for an Oracle V2 feed",
        json.dumps({"price": price, "confidenceBps": 9200, "reason": "Official source value."}),
    )


def _mock_ruling(vm, kind, ruling, revised):
    vm.mock_llm(
        rf"resolving an Oracle V2 {kind}",
        json.dumps({
            "ruling": ruling, "revisedOutcome": revised,
            "confidenceDeltaBps": -900 if revised == "not_met" else 700,
            "reason": "The filing supplies controlling public evidence.", "riskFlags": [],
        }),
    )


def test_deploy_script_and_frontend_have_one_canonical_v2_source():
    root = Path(CONTRACT).parents[1]
    deploy_source = (root / "scripts" / "deploy_only.py").read_text(encoding="utf-8")
    assert '"contracts" / "oracle_v2.py"' in deploy_source
    assert "oracle_bradbury.py" not in deploy_source
    source = Path(CONTRACT).read_text(encoding="utf-8")
    assert "Equal only if normalized price, ok and confidenceBps are exactly identical" in source
    mapping = json.loads((root / "contract.config.json").read_text(encoding="utf-8"))
    deployment = json.loads((root / mapping["deploymentRecord"]).read_text(encoding="utf-8"))
    frontend = (root / mapping["frontendAddressFile"]).read_text(encoding="utf-8")
    assert mapping["canonicalSource"] == "contracts/oracle_v2.py"
    assert mapping["sourceSha256"] == hashlib.sha256(source.encode()).hexdigest()
    assert mapping["contractAddress"] == deployment["contractAddress"]
    assert mapping["deployTxHash"] == deployment["deployTxHash"]
    assert mapping["contractAddress"] in frontend


def test_posted_feed_runs_review_challenge_appeal_and_permissionless_settlement(
    deploy, direct_vm, direct_alice, direct_bob, direct_charlie
):
    contract, feed_id = _deploy_feed(deploy, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    _mock_price(direct_vm)
    assert contract.review_claim_with_genlayer(str(feed_id)) == "met"
    record = json.loads(contract.get_claim_record(str(feed_id)))
    assert record["status"] == "CHALLENGE_WINDOW"
    assert record["verifiedPrice"] == "3020"
    assert record["feedStatus"] == 2

    challenge_id = contract.submit_challenge(
        str(feed_id), "The source reports a different settlement timestamp.", "https://example.org/challenge"
    )
    _mock_ruling(direct_vm, "challenge", "accepted", "not_met")
    contract.resolve_challenge_with_genlayer(str(feed_id), challenge_id)

    direct_vm.sender = direct_charlie
    appeal_id = contract.submit_appeal(
        str(feed_id), "The timestamp is correct in the final publication.", "https://example.net/appeal"
    )
    _mock_ruling(direct_vm, "appeal", "granted", "met")
    contract.resolve_appeal_with_genlayer(str(feed_id), appeal_id)
    direct_vm.warp("2026-07-16T14:00:01Z")
    contract.settle(feed_id)
    record = json.loads(contract.get_claim_record(str(feed_id)))
    assert record["status"] == "RESOLVED"
    assert record["outcome"] == "met"


def test_multiple_challenger_bonds_are_independent_stakes(
    deploy, direct_vm, direct_alice, direct_bob, direct_charlie
):
    contract, feed_id = _deploy_feed(deploy, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    _mock_price(direct_vm)
    contract.verify(feed_id)

    direct_vm.value = GEN
    contract.challenge(feed_id)
    direct_vm.sender = direct_charlie
    contract.challenge(feed_id)
    direct_vm.value = 0

    record = json.loads(contract.get_claim_record(str(feed_id)))
    assert len(record["challengerIds"]) == 2
    assert contract.get_stake_count() == 3
    assert contract.get_stake(1)["staker"].lower() != contract.get_stake(2)["staker"].lower()


def test_failed_payout_is_not_swallowed_or_marked_successfully():
    source = Path(CONTRACT).read_text(encoding="utf-8")
    start = source.index("    def claim_winnings")
    end = source.index("    def open_challenge_window", start)
    payout_path = source[start:end]
    assert "self._pay(Address(actor), u256(owed))" in payout_path
    assert "except Exception:\n            pass\n        self._pay" not in payout_path
    assert "['claimed'] = 1" in payout_path or 'claimed\"] = 1' in payout_path
