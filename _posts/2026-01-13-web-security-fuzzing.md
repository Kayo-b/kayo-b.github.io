---
title: "Web Security - Fuzzing"
date: 2026-01-13
categories: [infosec, web-security]
tags: [fuzzing, ffuf, gobuster, feroxbuster, wenum, subdomain-enumeration, directory-enumeration, htb]
toc: true
toc_label: "Contents"
toc_icon: "search"
excerpt: "Reference notes - Web fuzzing tools, techniques, and methodologies for vulnerability discovery."
---

## Overview

Fuzzing uncovers hidden vulnerabilities through automated security testing, strengthening input validation, improving code quality, and enabling continuous security. Fuzzing integrates into the software development lifecycle as part of CI/CD pipelines.

**Essential Concepts:**
- Wordlist
- Payload
- Response analysis fuzzer
- False positive/negative
- Fuzzing scope

## Fuzzing Tools

### Requirements
- Go
- Python3
- pipx (set ensurepath to --global)

### Tool Comparison

**FFUF** ("Fuzz Faster U Fool")
- Directory and file enumeration
- Parameter discovery
- Brute-force attack capabilities

**Gobuster**
- Content discovery
- DNS subdomain enumeration
- WordPress content detection

**FeroxBuster**
- Recursive scanning
- Unlinked content discovery
- High-performance scans

**wfuzz/wenum**
- Directory and file enumeration
- Parameter discovery
- Brute-forcing

**Wordlist Repository:** [SecLists](https://github.com/danielmiessler/SecLists)

## FFUF Usage

### Basic Directory Enumeration

```bash
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -u http://IP:PORT/FUZZ
```

### File Extension Discovery

```bash
ffuf -w common.txt -u http://IP:PORT/webfuzzing_hidden_path/FUZZ -e .php,.html,.txt,.bak,.js -v
```

### Recursive Enumeration

```bash
# Basic recursion
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -ic -v -u http://IP:PORT/FUZZ -e .html -recursion

# Advanced recursion with depth and rate limiting
ffuf -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -ic -u http://IP:PORT/FUZZ -e .html -recursion -recursion-depth 2 -rate 500
```

### GET Parameter Fuzzing

```bash
wenum -w /usr/share/seclists/Discovery/Web-Content/common.txt --hc 404 -u "http://IP:PORT/get.php?x=FUZZ"
```

### POST Request Fuzzing

```bash
# Discover body content by fuzzing POST data
ffuf -u http://IP:PORT/post.php -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "y=FUZZ" -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200 -v

# Make POST request with discovered value
curl -d "y=SUCWmc" http://IP:PORT/post.php
```

### FFUF Flags

| Flag | Description |
|------|-------------|
| `-w` | Path to wordlist |
| `-u` | Base URL to fuzz |
| `-e` | File extensions to append |
| `-v` | Verbose mode |
| `-ic` | Ignore comments in wordlist |
| `-recursion` | Enable recursive fuzzing |
| `-recursion-depth` | Set recursion depth (2,3,4...) |
| `-rate` | Request rate limit |
| `-timeout` | Request timeout |
| `--hc` | Hide status codes (e.g., `--hc 404`) |
| `-mc` | Match status codes (e.g., `-mc 200,204`) |
| `-fc` | Filter status codes |
| `-fs` | Filter by response size (e.g., `-fs 100-200`) |
| `-ms` | Match by response size |
| `-fw` | Filter by word count |
| `-mw` | Match by word count |
| `-fl` | Filter by line count |
| `-ml` | Match by line count |
| `-mt` | Match by response time |

## Virtual Hosts and Subdomains

### Virtual Hosts
- Identified by Host header in HTTP requests
- Host multiple websites on a single server
- Misconfigured vhosts expose internal applications or sensitive data

### Subdomains
- Identified by DNS records pointing to specific IP addresses
- Organize different sections or services within a website
- Subdomain takeover vulnerabilities occur if DNS records are mismanaged

## Gobuster

### Virtual Host Fuzzing

```bash
gobuster vhost -u http://inlanefreight.htb:81 -w /usr/share/seclists/Discovery/Web-Content/common.txt --append-domain
```

**Note:** DNS address must be added to `/etc/hosts` for vhost scanning:

```bash
echo "IP target.htb" | sudo tee -a /etc/hosts
```

### DNS Subdomain Enumeration

```bash
gobuster dns -d target.com -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
```

### Directory Enumeration with Filtering

```bash
# Find directories with status 200 or 301, exclude empty responses
gobuster dir -u http://example.com/ -w wordlist.txt -s 200,301 --exclude-length 0
```

### Gobuster Flags

| Flag | Description |
|------|-------------|
| `gobuster vhost` | Activate vhost fuzzing mode |
| `-u` | Specify base URL |
| `--append-domain` | Append base domain to fuzzing attempts |
| `-s` | Include responses with specific statuses (e.g., `-s 302`) |
| `-b` | Exclude specific response codes |
| `--exclude-length` | Exclude specific response sizes (comma-separated, supports ranges) |

## API Fuzzing

### API Endpoint Types

**REST** (Most Common)

```
/users?limit=10&sort=name
```

**GraphQL Query**

```graphql
query {
  user(id: 123) {
    name
    email
    posts(limit: 5) {
      title
      body
    }
  }
}
```

**GraphQL Mutation**

```graphql
mutation {
  createPost(title: "New Post", body: "This is the content of the new post") {
    id
    title
  }
}
```

**SOAP**

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:lib="http://example.com/library">
   <soapenv:Header/>
   <soapenv:Body>
      <lib:SearchBooks>
         <lib:keywords>cybersecurity</lib:keywords>
         <lib:author>Dan Kaminsky</lib:author>
      </lib:SearchBooks>
   </soapenv:Body>
</soapenv:Envelope>
```

### API Fuzzing Types
- **Parameter fuzzing:** Test different parameter values
- **Data format fuzzing:** Test various data structures
- **Sequence fuzzing:** Test API call sequences

### API Fuzzer Tool

```bash
git clone https://github.com/PandaSt0rm/webfuzz_api.git
cd webfuzz_api
pip3 install -r requirements.txt

python3 api_fuzzer.py http://IP:PORT
```

## Practical Example

```bash
# Initial parameter fuzzing
ffuf -u http://IP:PORT/admin/panel.php?accessID=FUZZ -w common.txt -fs 59

# Add target to /etc/hosts
echo 'IP fuzzing_fun.htb' | sudo tee -a /etc/hosts

# Virtual host discovery
gobuster vhost -u http://fuzzing_fun.htb:PORT -w common.txt

# Directory enumeration on discovered vhost
ffuf -u http://fuzzing_fun.htb:PORT/FUZZ -w common.txt

# Recursive vhost discovery with filtering
gobuster vhost -u http://fuzzing_fun.htb:PORT -w common.txt --append-domain | grep 'Status: 200'

# Deep directory fuzzing on hidden vhost
ffuf -u http://hidden.fuzzing_fun.htb:PORT/godeep/FUZZ -w common.txt -v

# Retrieve discovered resource
curl http://hidden.fuzzing_fun.htb:PORT/godeep/stoneedge/bbclone/typo3/index.php
```
