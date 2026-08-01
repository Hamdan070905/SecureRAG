from fastapi import Header, HTTPException, Depends
from typing import Optional
import os
import re
import time
from collections import defaultdict

# PII masking patterns (applied to logs, not to the answer shown to the user)
PII_PATTERNS = [
    (re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"), "[EMAIL]"),
    (re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"), "[PHONE]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[CARD]"),
]

def mask_pii(text: str) -> str:
    if not text:
        return text
    for pattern, placeholder in PII_PATTERNS:
        text = pattern.sub(placeholder, text)
    return text

# Rate limiting
query_times = defaultdict(list)
RATE_LIMIT = 10  # queries per minute

INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all instructions",
    "forget your instructions",
    "you are now", "act as",
    "pretend you are", "disregard",
    "override", "jailbreak", "bypass",
    "system prompt", "new instructions",
    "forget everything", "ignore above"
]

TOXIC_PATTERNS = [
    "hack", "exploit", "steal", "illegal",
    "weapon", "bomb", "malware", "virus",
    "phishing", "ransomware"
]

def check_rate_limit(session_id: str = "default") -> tuple:
    now = time.time()
    minute_ago = now - 60
    
    # Prune current session
    query_times[session_id] = [
        t for t in query_times[session_id] if t > minute_ago
    ]
    
    # Prune expired session keys to prevent memory leak
    expired_sessions = [s for s, times in list(query_times.items()) if not times]
    for s in expired_sessions:
        if s != session_id:
            query_times.pop(s, None)
            
    if len(query_times[session_id]) >= RATE_LIMIT:
        return True, f"Rate limit: max {RATE_LIMIT} queries/minute"
    query_times[session_id].append(now)
    return False, None

def check_injection(query: str) -> tuple:
    q = query.lower()
    for p in INJECTION_PATTERNS:
        if p in q:
            return True, f"Prompt injection: '{p}'"
    return False, None

def check_toxic(query: str) -> tuple:
    q = query.lower()
    for p in TOXIC_PATTERNS:
        if p in q:
            return True, f"Harmful content: '{p}'"
    return False, None

def check_length(query: str) -> tuple:
    if len(query) > 2000:
        return True, "Query too long (max 2000 chars)"
    if len(query) < 3:
        return True, "Query too short"
    return False, None

def get_current_user(x_user_id: Optional[str] = Header(None)) -> str:
    return x_user_id or "default_user"

try:
    from supabase import create_client, Client
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")
    supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None
except Exception:
    supabase = None

def get_current_role(user_id: str) -> str:
    try:
        if supabase:
            r = supabase.table("user_roles").select("role").eq("user_id", user_id).single().execute()
            return r.data["role"]
        return "employee"
    except Exception:
        return "employee"

def require_role(*allowed: str):
    def checker(user_id: str = Depends(get_current_user)) -> str:
        role = get_current_role(user_id)
        if role not in allowed:
            raise HTTPException(403, "Insufficient permissions")
        return user_id
    return checker

def run_security_checks(query: str,
                        session_id: str = "default") -> tuple:
    checks = [
        check_rate_limit(session_id),
        check_injection(query),
        check_toxic(query),
        check_length(query)
    ]
    for flagged, msg in checks:
        if flagged:
            return False, f"🚨 Security: {msg}"
    return True, "✅ All checks passed"