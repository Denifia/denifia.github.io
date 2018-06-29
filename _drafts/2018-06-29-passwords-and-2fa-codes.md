---
published: false
---
## Passwords & 2FA Codes

I'm about to factory reset my mobile phone and one of my preparation steps is to ensure that I don't lose my 2FA codes. Over time the number of websites I use with 2FA has grown; making the task of backup/migrating codes a pain. I don't want to go through this again... I need a long term solution.

Enter text in [Markdown](http://daringfireball.net/projects/markdown/). Use the toolbar above, or click the **?** button for formatting help.


I said a while back that I was moving my 2FA codes into 1Password.... well, after having a few discussions with some friends I've realized that approach has flaws. I'm changing my approach to this...

1Password - with unique master password
* Stores all my passwords
* Does NOT store my password for Authy

Authy - with unique master password
* Stores my 2FA codes

This way, if someone gets into my 1Password account, they have all my passwords but still need 2FA codes for most of my accounts (specifically things like crypto and banking). If they get into my Authy account, it doesn't help them at all - they don't have the password.