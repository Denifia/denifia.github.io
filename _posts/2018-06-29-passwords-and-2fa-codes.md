---
published: true
layout: post
---
## Passwords & 2FA Codes

I'm about to factory reset my mobile phone and one of my preparation steps is to ensure that I don't lose my 2FA codes. Over time the number of websites I use with 2FA has grown, making the task of backup/migrating codes a pain as they need to be migrated to the new device one at a time. I don't want to go through this again; I need a long term solution.

My initial thought was to move all my 2FA codes into 1Password but that approach has a glaring flaw. If my 1Password account was compromised, the attacker would have the password & 2FA code to breach all my other accounts.

After a bit of research, I've decided to move my 2FA codes to Authy. It's a multi device authenticator that has online encrypted backups. With my authenticator chosen, my plan is to have the following setup:

**1Password** - with unique master password
* Stores my passwords
* It does *NOT* store my Authy password

**Authy** - with unique master password
* Stores my 2FA codes

This way if an attacker gets into my 1Password account, they have my passwords but still need 2FA codes; protecting me against an all out breach. If they get into my Authy account it doesn't help them at all - they only have 2FA codes and no passwords.
