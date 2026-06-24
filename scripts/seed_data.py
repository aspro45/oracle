"""Seed Oracle V2 with public price feeds on Studionet."""
from pathlib import Path
from gltest_cli.config.general import get_general_config
from gltest_cli.config.user import load_user_config
from gltest import get_contract_factory, get_default_account

ROOT = Path(__file__).resolve().parents[1]
cfg = load_user_config(str(ROOT / "gltest.studionet.yaml"))
get_general_config().user_config = cfg

ADDR = "0x215585A266e5a9249057dd5E1096692957D4F319"
GEN = 10 ** 18

acct = get_default_account()
factory = get_contract_factory(contract_file_path=str(ROOT / "contracts" / "oracle_v2.py"))
contract = factory.build_contract(ADDR, account=acct)

# Real assets + real public source URLs the contract could read on verify.
feeds = [
    ("BTC",  "https://api.coinbase.com/v2/prices/BTC-USD/spot",  "67500", 5, 1.0),
    ("ETH",  "https://api.coinbase.com/v2/prices/ETH-USD/spot",  "3520",  5, 1.0),
    ("SOL",  "https://api.coinbase.com/v2/prices/SOL-USD/spot",  "142",   5, 0.5),
    ("GOLD", "https://www.gold.org/goldhub/data/gold-prices",    "2048",  3, 0.5),
]

for asset, url, price, tol, bond in feeds:
    try:
        contract.post_price(args=[asset, url, price, tol]).transact(value=int(bond * GEN))
        print(f"posted {asset} @ {price} (bond {bond} GEN)", flush=True)
    except Exception as e:
        print(f"FAILED {asset}: {e}", flush=True)

print("count=" + str(contract.get_feed_count().call()), flush=True)
