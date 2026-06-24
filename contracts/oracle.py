# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ORACLE - Decentralized AI Price Feed
=====================================
Anyone can post a price claim for any asset (BTC, ETH, gold, oil...) by naming
a public data source URL. The contract reads that source and the validator set
agrees on the current price via the Equivalence Principle. Feeds are bonded -
the poster stakes GEN that their claim is accurate (within tolerance). A
challenger can dispute a feed by posting an equal counter-bond. If the fresh
read disagrees with the original claim, the challenger takes both bonds.

Lifecycle:
    POSTED   -> price claim made with bond, open to challenge
    VERIFIED -> re-read confirmed the price, poster keeps bond
    DISPUTED -> a challenger bonded against it
    SETTLED  -> re-read after dispute, winner takes pot
"""

from genlayer import *
from dataclasses import dataclass
import json
import typing


STATUS_POSTED = 0
STATUS_VERIFIED = 1
STATUS_DISPUTED = 2
STATUS_SETTLED = 3


@allow_storage
@dataclass
class Feed:
    poster: Address
    challenger: Address
    asset: str
    source_url: str
    claimed_price: str       # string to avoid float precision issues
    verified_price: str
    bond: u256
    tolerance_pct: u8        # e.g. 5 = 5% tolerance
    status: u8
    winner: u8               # 0=none, 1=poster, 2=challenger
    timestamp: str


class Oracle(gl.Contract):
    feeds: DynArray[Feed]

    def __init__(self) -> None:
        pass

    @gl.public.write.payable
    def post_price(self, asset: str, source_url: str, claimed_price: str, tolerance_pct: int) -> int:
        if len(asset.strip()) == 0:
            raise gl.vm.UserError("asset name required")
        if len(source_url.strip()) == 0:
            raise gl.vm.UserError("source URL required")
        if len(claimed_price.strip()) == 0:
            raise gl.vm.UserError("claimed price required")
        bond = gl.message.value
        if bond == u256(0):
            raise gl.vm.UserError("must post a bond")
        if tolerance_pct < 1 or tolerance_pct > 50:
            raise gl.vm.UserError("tolerance must be 1-50%")
        f = self.feeds.append_new_get()
        f.poster = gl.message.sender_address
        f.challenger = Address(bytes(20))
        f.asset = asset
        f.source_url = source_url
        f.claimed_price = claimed_price
        f.verified_price = ""
        f.bond = bond
        f.tolerance_pct = u8(tolerance_pct)
        f.status = u8(STATUS_POSTED)
        f.winner = u8(0)
        f.timestamp = ""
        return len(self.feeds) - 1

    @gl.public.write.payable
    def challenge(self, feed_id: int) -> None:
        f = self._get(feed_id)
        if f.status != STATUS_POSTED:
            raise gl.vm.UserError("feed not open to challenge")
        if gl.message.sender_address == f.poster:
            raise gl.vm.UserError("cannot challenge your own feed")
        if gl.message.value != f.bond:
            raise gl.vm.UserError("must match the bond exactly")
        f.challenger = gl.message.sender_address
        f.status = u8(STATUS_DISPUTED)

    @gl.public.write
    def verify(self, feed_id: int) -> None:
        f = self._get(feed_id)
        if f.status != STATUS_POSTED and f.status != STATUS_DISPUTED:
            raise gl.vm.UserError("feed already settled")

        url = f.source_url
        asset = f.asset
        claimed = f.claimed_price
        tolerance = int(f.tolerance_pct)

        def leader_fn() -> str:
            page = gl.nondet.web.get(url).body.decode("utf-8")[:6000]
            prompt = (
                f"Asset: {asset}\n"
                f"Source page content:\n{page}\n\n"
                f"Extract the current price of {asset} from the page above. "
                "Reply with ONLY JSON: {\"price\": \"<number>\"} "
                "where price is the numeric value (no currency symbols). "
                "If the page does not contain a clear price, reply {\"price\": \"UNKNOWN\"}."
            )
            return gl.nondet.exec_prompt(prompt)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            lp = self._extract_price(leader_res.calldata)
            vp = self._extract_price(leader_fn())
            if lp is None or vp is None:
                return lp is None and vp is None
            if vp == 0:
                return lp == 0
            return abs(lp - vp) / vp < 0.1

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        price = self._extract_price(result)
        if price is None:
            f.verified_price = "UNKNOWN"
        else:
            f.verified_price = str(price)

        disputed = f.challenger != Address(bytes(20))

        if price is None:
            # can't verify - refund both sides
            if disputed:
                self._pay(f.poster, f.bond)
                self._pay(f.challenger, f.bond)
            else:
                self._pay(f.poster, f.bond)
            f.status = u8(STATUS_SETTLED)
            f.winner = u8(0)
            return

        # Check if claimed price is within tolerance
        try:
            claimed_num = float(claimed)
        except (ValueError, TypeError):
            claimed_num = 0.0

        within = False
        if claimed_num > 0 and price > 0:
            diff_pct = abs(price - claimed_num) / claimed_num * 100
            within = diff_pct <= tolerance

        if disputed:
            f.status = u8(STATUS_SETTLED)
            if within:
                f.winner = u8(1)  # poster wins
                self._pay(f.poster, f.bond + f.bond)
            else:
                f.winner = u8(2)  # challenger wins
                self._pay(f.challenger, f.bond + f.bond)
        else:
            if within:
                f.status = u8(STATUS_VERIFIED)
                f.winner = u8(1)
                self._pay(f.poster, f.bond)
            else:
                f.status = u8(STATUS_SETTLED)
                f.winner = u8(0)
                # poster was wrong - bond slashed (stays in contract)

    # ------------------------------------------------------------------ views
    @gl.public.view
    def get_feed_count(self) -> int:
        return len(self.feeds)

    @gl.public.view
    def get_feed(self, feed_id: int) -> dict:
        f = self._get(feed_id)
        return {
            "poster": f.poster.as_hex,
            "challenger": f.challenger.as_hex,
            "asset": f.asset,
            "source_url": f.source_url,
            "claimed_price": f.claimed_price,
            "verified_price": f.verified_price,
            "bond": str(f.bond),
            "tolerance_pct": int(f.tolerance_pct),
            "status": int(f.status),
            "winner": int(f.winner),
        }

    # -------------------------------------------------------------- internals
    def _get(self, feed_id: int) -> Feed:
        if feed_id < 0 or feed_id >= len(self.feeds):
            raise gl.vm.UserError("no such feed")
        return self.feeds[feed_id]

    def _extract_price(self, result: typing.Any) -> typing.Optional[float]:
        data = result
        if isinstance(data, str):
            data = self._extract_json(data)
        if not isinstance(data, dict):
            return None
        raw = str(data.get("price", "")).strip()
        if raw.upper() == "UNKNOWN" or not raw:
            return None
        try:
            return float(raw.replace(",", ""))
        except (ValueError, TypeError):
            return None

    def _extract_json(self, text: str) -> typing.Any:
        try:
            return json.loads(text)
        except (ValueError, TypeError):
            pass
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except (ValueError, TypeError):
                return None
        return None

    def _pay(self, recipient: Address, amount: u256) -> None:
        if amount == u256(0):
            return
        _Payee(recipient).emit_transfer(value=amount)


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass
