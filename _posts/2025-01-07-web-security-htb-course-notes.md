---
title: "Web Security Fundamentals - HTB Course Notes"
date: 2025-01-07
categories: [infosec, web-security]
tags: [web-security, curl, http, xss, csrf, sql-injection, htb]
toc: true
toc_label: "Contents"
toc_icon: "shield-alt"
excerpt: "A detailed walk through web security concepts, HTTP protocols, and common vulnerabilities including XSS and CSRF attacks."
---

## Working with HTTP Requests

### Understanding cURL

The `curl` command is your bread and butter for manual HTTP testing. It's what you reach for when you need to interact with web servers without the overhead of a browser.

**Basic usage with verbosity:**
```bash
curl <url> -v      # basic verbose output
curl <url> -vvv    # maximum verbosity
```

The verbosity flags show you what's happening under the hood - the handshake, headers sent, headers received. When you're troubleshooting why something isn't working, this information is gold.

**Requesting headers:**
```bash
curl -I <url>      # sends a HEAD request (headers only)
curl -i <url>      # send request and shows headers + body
```

The difference between `-I` and `-i` matters. Use `-I` when you only care about metadata like content type or server information. Use `-i` when you need both context and content.

**Modifying request headers:**
```bash
curl <url> -A 'Mozilla/5.0'    # changes the User-Agent to Mozilla/5.0
```

Some servers behave differently based on the User-Agent. Changing it lets you see how the application responds to different clients - browsers, bots, or custom tools.

### SSH Configuration

Before diving deeper into web testing, a quick note on SSH configuration:
```bash
/etc/ssh/sshd_config    # configure your local ssh server
```

This file controls how your SSH daemon behaves. When you're setting up a testing environment, you'll often need to tweak these settings to allow specific authentication methods or access patterns.

## Authentication Methods

Web applications handle authentication in different ways. Here are three methods for passing credentials using curl:

**Method 1 - Using the -u flag:**
```bash
curl -u admin:admin http://<SERVER_IP>:<PORT>/
```

This is the cleanest approach when you're doing HTTP Basic Authentication. The `-u` flag handles the encoding for you.

**Method 2 - Inline credentials:**
```bash
curl http://admin:admin@<SERVER_IP>:<PORT>/
```

Same effect as method 1, just a different syntax. Some people find this more readable when embedding in scripts.

**Method 3 - Manual Authorization header:**
```bash
curl -H 'Authorization: Basic YWRtaW46YWRtaW4=' http://<SERVER_IP>:<PORT>/
```

This approach is useful when you've captured authentication tokens from cookies or other sources. The value `YWRtaW46YWRtaW4=` is the base64-encoded string of `admin:admin`. You can grab these from browser dev tools and replay them to test if sessions are properly secured.

## POST Requests and Data Handling

GET requests are fine for reading data, but when you need to submit forms or send data to the server, POST is what you need.

**Basic POST request:**
```bash
curl -X POST -d 'username=admin&password=admin' http://<serverip>:<PORT>
```

Breaking down the flags:
- `-X POST` : Specifies the HTTP method
- `-d` : Sends the data payload
- `-L` : Follows redirects automatically (add this if the server redirects after login)
- `-s` : Silences curl's progress meter
- `-I` : Shows only headers (useful for checking response codes)

### Session Management

After authenticating, many web apps use session cookies to track your identity. Here's how to work with them:

**Getting the session ID:**
```bash
curl -X POST -d 'username=admin&password=admin' http://<server-ip>:<port> -i
```

The `-i` flag displays both headers and body. Look in the headers for something like `Set-Cookie: PHPSESSID=abc123...`. That's your session identifier.

**Using the session ID:**
```bash
curl -b 'PHPSESSID=<session-id>' http://<serverid>:<port>
```

The `-b` flag lets you send cookies with your request. This simulates being logged in without going through the authentication flow each time.

**Complex requests with JSON:**
```bash
curl -X POST -d '{"search":"london"}' -b 'PHPSESSID=<id>' -H 'Content-Type: application/json' http://<serverip:port>/search.php
```

Modern web APIs often expect JSON payloads. The `-H` flag sets the Content-Type header to tell the server you're sending JSON, not form data. Get this wrong and the server might reject your request or parse it incorrectly.

### Browser Developer Tools Trick

When you're working with complex requests in the browser, you don't have to manually reconstruct them in curl. In the Network tab of DevTools, right-click any request and select **Copy as Fetch**. This copies a JavaScript fetch function to your clipboard that you can paste into the console, modify, and rerun. It's a massive time-saver for testing API modifications.

## HTTP Status Codes

Status codes tell you what happened with your request. Knowing them well helps you troubleshoot issues faster.

| **Class** | **Description**                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **1xx**   | informational - the request is being processed, but no final response yet.                                                       |
| **2xx**   | success - the request worked as intended.                                                                                        |
| **3xx**   | redirection - the client needs to take additional action to complete the request.                                                |
| **4xx**   | client error - the request was malformed or asked for something that doesn't exist.                                              |
| **5xx**   | server error - the server failed to process a valid request.                                                                     |

**Common status codes you'll encounter:**

- **200 OK** - Request succeeded. You got what you asked for.
- **302 Found** - Redirect. The resource moved temporarily to another URL.
- **400 Bad Request** - Your request was malformed. Check syntax.
- **403 Forbidden** - You don't have permission to access this resource.
- **404 Not Found** - The resource doesn't exist at the requested path.
- **500 Internal Server Error** - Something broke on the server side. This is what you're often trying to trigger in security testing to expose vulnerabilities.

### Formatting JSON Responses

When dealing with JSON responses, raw output can be hard to read. Pipe it through `jq`:
```bash
<curl command> | jq
```

The `jq` tool pretty-prints JSON, making it much easier to parse visually. It can also filter and transform JSON data if you need specific fields.

## Types of Web Vulnerabilities

Understanding common vulnerabilities helps you know what to look for when testing applications.

### SQL Injection

SQL injection lets attackers manipulate database queries by inserting malicious SQL code into input fields. A successful SQL injection attack can:
- Extract database contents
- Bypass authentication
- Execute administrative operations
- In some cases, even run operating system commands

One common escalation path: use SQL injection to obtain Active Directory usernames, then perform password spraying attacks against the domain.

### File Inclusion

File inclusion vulnerabilities occur when an application accepts user input to specify which file to include or execute. Attackers can abuse this to:
- Read source code files to discover hidden functionality
- Access configuration files containing credentials
- Include remote files with malicious code
- Achieve remote code execution

Finding a file inclusion bug often means reading the application's source to discover hidden pages or directories that expose additional attack surface.

### Unrestricted File Upload

When an application lets users upload files without proper validation, bad things can happen. Consider a profile picture upload that accepts any file type, not just images. An attacker could:
- Upload a PHP web shell
- Upload an executable that runs on the server
- Replace configuration files
- Upload files that exploit parser vulnerabilities

A file upload vulnerability can be a direct path to full server compromise if the uploaded file can be accessed and executed.

### Insecure Direct Object Referencing (IDOR)

IDOR occurs when an application exposes internal identifiers (like database IDs) in URLs or parameters without checking if the user should have access. For example:

```
https://example.com/user/701/edit-profile
```

If the application doesn't verify that you're user 701, what happens when you change the URL to `/user/702/edit-profile`? If it lets you edit someone else's profile, that's IDOR.

This vulnerability is often paired with broken access control. The identifier is exposed, but the application fails to verify authorization.

### Broken Access Control

Access control determines what users can do in an application. When it breaks, users can perform actions they shouldn't be allowed to. Consider this scenario:

A user registration form submits:
```
username=bjones&password=Welcome1&email=bjones@inlatefreight.local&roleid=3
```

Notice that `roleid=3` parameter? What happens if you change it to `roleid=1` or `roleid=0`? If the application doesn't validate this server-side, you might just create an admin account instead of a regular user account.

This isn't theoretical - broken access control in registration flows has been found in production applications. It turns user registration into privilege escalation.

## Web Application Architecture

Understanding how web applications are structured helps you identify where vulnerabilities might exist.

### Core Components

**1. Client**
The user's browser or application. This is the trust boundary - never trust client-side validation alone.

**2. Server**
The server typically consists of three layers:
- **Webserver**: Handles HTTP requests (Apache, Nginx, IIS)
- **Web Application Logic**: Your application code (PHP, Node.js, Python, etc.)
- **Database**: Stores persistent data (MySQL, PostgreSQL, MongoDB, etc.)

**3. Services (Microservices)**
Modern applications often integrate with:
- Third-party APIs (payment processors, authentication providers)
- Internal microservices (separate applications handling specific functions)

**4. Functions (Serverless)**
Event-driven functions that execute on-demand without managing servers. These can introduce unique security considerations around function permissions and event triggers.

### Architectural Layers

**Presentation Layer**
The user interface - what the user sees and interacts with. Security here focuses on preventing XSS and ensuring proper output encoding.

**Application Layer**
Where business logic lives and web requests are processed. This is where most vulnerability classes exist - authentication flaws, authorization issues, injection attacks.

**Data Layer**
Works with the application layer to store and retrieve data. Security concerns include SQL injection, data exposure, and access control.

## URL Encoding

Special characters in URLs need to be encoded because they have special meanings in HTTP. When testing web applications, you'll often need to encode payloads manually.

Reference: [W3Schools URL Encoding](https://www.w3schools.com/tags/ref_urlencode.ASP)

| Character | Encoding |
| --------- | -------- |
| space     | %20      |
| !         | %21      |
| "         | %22      |
| #         | %23      |
| $         | %24      |
| %         | %25      |
| &         | %26      |
| '         | %27      |
| (         | %28      |
| )         | %29      |

When you inject payloads, especially in GET parameters, proper URL encoding ensures the payload reaches the application intact.

## Cross-Site Scripting (XSS)

XSS attacks inject malicious scripts into web pages viewed by other users. There are three main types:

### Reflected XSS

Occurs when user input is immediately displayed on the page after processing. Common in:
- Search results pages
- Error messages
- Form validation messages

The malicious script isn't stored - it's reflected back in the response. An attacker typically sends a crafted link to a victim, and when they click it, the script executes in their browser context.

### Stored XSS

More dangerous than reflected XSS because the malicious input is stored in the backend database. When retrieved and displayed, it affects every user who views it. Common locations:
- Comment sections
- User profiles
- Forum posts
- Any user-generated content displayed to others

### DOM XSS

Occurs when client-side JavaScript writes user input directly into the HTML DOM without proper sanitization. This happens entirely in the browser - the payload might never touch the server. Common targets:
- Username displays
- Page titles
- Dynamic content rendering

### XSS Payload Example

Here's a practical XSS payload that attempts to steal cookies:

```javascript
#"><img src=/ onerror=alert(document.cookie)>
```

Breaking this down:
- `#">` closes any existing HTML attributes or tags
- `<img src=/` creates an image tag with an invalid source
- `onerror=alert(document.cookie)>` executes JavaScript when the image fails to load

In a real attack, you'd replace `alert(document.cookie)` with code that sends the cookies to a server you control. This is why HttpOnly cookies exist - to prevent JavaScript from accessing session cookies.

## Cross-Site Request Forgery (CSRF)

CSRF tricks authenticated users into performing unintended actions. Unlike XSS which steals data or executes code, CSRF forces the user's browser to send state-changing requests.

The attack works because:
1. The user is authenticated to a website
2. The attacker crafts a malicious request
3. The user's browser automatically includes authentication cookies
4. The server processes the request as legitimate

**Example CSRF payload:**
```html
"><script src=//www.example.com/exploit.js></script>
```

The injected script could contain code that:
- Changes the user's password
- Transfers money
- Modifies account settings
- Performs any action the authenticated user has permission to do

### CSRF Prevention

Modern applications defend against CSRF using:
- Anti-CSRF tokens (unpredictable values tied to the user's session)
- SameSite cookie attributes
- Requiring re-authentication for sensitive actions
- Checking the Origin and Referer headers

For a deep dive into CSRF prevention, check out the [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Conclusion

Web security comes down to understanding how applications communicate, where trust boundaries exist, and what happens when assumptions about user input break down. The techniques covered here - from basic curl usage to understanding XSS and CSRF - form the foundation of web application security testing.

The key takeaway is this: always validate input, encode output, and never trust data that crosses a trust boundary. Whether you're testing applications or building them, keeping these principles in mind will save you from a world of pain.

Keep testing, keep learning, and most importantly - always get proper authorization before testing any system you don't own.
