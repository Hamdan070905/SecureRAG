import json
import os
from datetime import datetime

LOG_FILE = "audit_log.json"

def log_query(query: str, is_safe: bool,
              security_msg: str, answer: str = None,
              doc_name: str = None, confidence: int = 0,
              response_time_ms: int = 0,
              faithfulness=None,
              groundedness=None):
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "query": query[:200],
        "security_passed": is_safe,
        "security_message": security_msg,
        "document": doc_name,
        "confidence": confidence,
        "faithfulness": faithfulness,
        "groundedness": groundedness,
        "answer_preview": answer[:150] if answer else None,
        "blocked": not is_safe,
        "response_time_ms": response_time_ms,
        
    }
    try:
        logs = []
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r') as f:
                logs = json.load(f)
        logs.append(entry)
        with open(LOG_FILE, 'w') as f:
            json.dump(logs, f, indent=2)
    except:
        pass
    return entry

def get_all_logs() -> list:
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return []

def get_stats() -> dict:
    logs = get_all_logs()
    if not logs:
        return {}
    total = len(logs)
    blocked = sum(1 for l in logs if l.get('blocked'))
    avg_conf = sum(
        l.get('confidence', 0) for l in logs
        if not l.get('blocked')
    )
    avg_faith = sum(
    l.get("faithfulness", 0)
    for l in logs
    if l.get("faithfulness") is not None
    )

    avg_ground = sum(
        l.get("groundedness", 0)
        for l in logs
        if l.get("groundedness") is not None
    )
    safe_count = total - blocked
    times = [l.get("response_time_ms", 0) for l in logs if l.get("response_time_ms")]
    return {
        "total": total,
        "blocked": blocked,
        "safe": safe_count,
        "avg_confidence": round(
            avg_conf / safe_count if safe_count > 0 else 0, 1
        ),
        "avg_faithfulness": round(
            avg_faith / safe_count if safe_count > 0 else 0, 1
        ),

        "avg_groundedness": round(
            avg_ground / safe_count if safe_count > 0 else 0, 1
        ),
        "avg_response_ms": round(sum(times) / len(times), 0) if times else 0,
    }

def get_hourly_activity() -> list:
    """Real (non-demo) hourly query counts for the last 24h, for dashboard charts."""
    logs = get_all_logs()
    buckets = {f"{h:02d}:00": 0 for h in range(24)}
    for l in logs:
        ts = l.get("timestamp", "")
        try:
            hour = ts.split(" ")[1].split(":")[0]
            buckets[f"{hour}:00"] += 1
        except Exception:
            continue
    return [{"hour": h, "queries": c} for h, c in buckets.items()]