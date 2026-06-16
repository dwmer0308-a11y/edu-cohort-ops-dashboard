#!/usr/bin/env python3
from __future__ import annotations

import json
import logging
import signal
import sys
from pathlib import Path
from typing import Any

import lark_oapi as lark
from lark_oapi.event.callback.model.p2_card_action_trigger import P2CardActionTriggerResponse

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / ".local" / "feishu-notify.json"
LOG_PATH = ROOT / ".local" / "feishu-card-callback-ws.log"

sys.path.insert(0, str(ROOT))
from server import handle_feishu_card_callback  # noqa: E402


def read_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise RuntimeError("缺少 .local/feishu-notify.json")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def to_plain(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [to_plain(item) for item in value]
    if isinstance(value, dict):
        return {key: to_plain(item) for key, item in value.items()}
    if hasattr(value, "__dict__"):
        return {key: to_plain(item) for key, item in value.__dict__.items() if not key.startswith("_")}
    return value


def on_card_action(data) -> P2CardActionTriggerResponse:
    payload = to_plain(data)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"event": payload}, ensure_ascii=False) + "\n")
    response = handle_feishu_card_callback(payload)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"response": response}, ensure_ascii=False) + "\n")
    return P2CardActionTriggerResponse(response)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = read_config()
    app_id = config.get("app_id")
    app_secret = config.get("app_secret")
    if not app_id or not app_secret:
        raise RuntimeError("飞书配置缺少 app_id 或 app_secret")

    dispatcher = (
        lark.EventDispatcherHandler
        .builder("", str(config.get("verification_token") or ""))
        .register_p2_card_action_trigger(on_card_action)
        .build()
    )
    client = lark.ws.Client(
        app_id,
        app_secret,
        log_level=lark.LogLevel.INFO,
        event_handler=dispatcher,
    )
    logging.info("飞书卡片长连接启动中：app_id=%s", app_id)

    def stop(_signum, _frame):
        logging.info("收到停止信号，退出长连接。")
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    client.start()


if __name__ == "__main__":
    main()
