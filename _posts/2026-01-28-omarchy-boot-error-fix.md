---
title: "Fixing Omarchy Boot Failure: Outdated EFI Entry and zram Timeout"
date: 2026-01-28
categories: [infosec, linux]
tags: [linux, boot, efi, systemd, troubleshooting, omarchy, zram]
toc: true
toc_label: "Contents"
toc_icon: "wrench"
excerpt: "Troubleshooting and fixing boot failures caused by outdated EFI entries and zram timeouts after kernel updates."
---

## The Problem

After a kernel update, Omarchy fails to boot automatically and drops to a root terminal with errors. The system shows a timeout waiting for `/dev/zram0`:

```
Jan 27 19:19:32 omarchy systemd[1]: dev-zram0.device: Job dev-zram0.device/start timed out.
Jan 27 19:19:32 omarchy systemd[1]: Timed out waiting for device /dev/zram0.
```

Meanwhile, manually selecting "Limine" from the BIOS boot menu and choosing the first Linux option boots successfully.

## Root Cause

Omarchy uses two EFI boot entries:
- **Omarchy**: Direct UKI boot (fast, no menu) - for normal use
- **Limine**: Bootloader menu - for snapshots and recovery

The issue occurs when the "Omarchy" EFI entry points to an outdated kernel file that no longer exists after a kernel update, while Limine points to the current kernel and works fine.

## Diagnosis

Check your EFI boot entries:

```bash
sudo efibootmgr -v
```

Look for the "Omarchy" entry and verify what file it points to:

```
Boot0007* Omarchy HD(...)/\EFI\Linux\fccb33d27a5b48c1a9006d981aad57f6_linux.efi
```

Check what files actually exist:

```bash
ls -la /boot/EFI/Linux/
```

If the file in the EFI entry doesn't match the current file, that's the problem.

Identify which partition holds your boot files:

```bash
lsblk -o NAME,UUID,MOUNTPOINT | grep /boot
```

Note the disk and partition (e.g., `nvme1n1p1`).

## Solution

### Step 1: Delete the Outdated Boot Entry

Find the boot number of the broken "Omarchy" entry from `efibootmgr -v`, then:

```bash
sudo efibootmgr -b 0007 -B
```

Replace `0007` with your actual boot number.

### Step 2: Create New Boot Entry

Using the correct disk and partition from your diagnosis:

```bash
sudo efibootmgr --create --disk /dev/nvme1n1 --part 1 --label "Omarchy" --loader '\EFI\Linux\omarchy_linux.efi' --unicode
```

Replace `/dev/nvme1n1` and `--part 1` with your actual disk and partition.

### Step 3: Set Boot Order

Check the new boot number:

```bash
sudo efibootmgr
```

Set it as first in boot order:

```bash
sudo efibootmgr -o 0004,0006,0003,0000
```

Replace `0004` with your new Omarchy boot number. This puts Omarchy first, Limine second.

### Step 4: Fix zram Timeout

Load the zram module early to prevent the 90-second timeout:

```bash
echo "zram" | sudo tee /etc/modules-load.d/zram.conf
```

### Step 5: Reboot

```bash
reboot
```

The system should now boot directly to Omarchy without errors or delays.

## What is zram?

zram is compressed swap in RAM. Omarchy uses it for swap space, but if the zram module doesn't load early enough, systemd waits 90 seconds for `/dev/zram0` to appear before timing out and continuing the boot. Loading it via `/etc/modules-load.d/` ensures it's available early in the boot process.

## Verifying the Fix

After reboot, check that:
1. System boots directly without stopping at terminal
2. No zram timeout errors in logs:
   ```bash
   journalctl -b | grep zram
   ```
3. zram swap is active:
   ```bash
   swapon --show
   ```

## Alternative: Use Limine as Primary

If you prefer to always boot through the Limine menu:

```bash
sudo nano /boot/limine.conf
```

Uncomment and set:
```
timeout: 3
default_entry: 1
```

This auto-selects the Linux entry after 3 seconds without requiring a separate Omarchy EFI entry.

## Prevention

Future kernel updates should automatically update the UKI file at `/boot/EFI/Linux/omarchy_linux.efi`. The EFI entry created in this guide points to this consistent filename, so it won't break again.

If you notice boot issues after updates, check:
```bash
ls -la /boot/EFI/Linux/
sudo efibootmgr -v
```

And verify the EFI entry matches the actual file.
