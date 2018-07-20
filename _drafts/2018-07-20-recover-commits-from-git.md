---
published: false
---
## Recover commits from git

Today I made a mistake. 

I was preparing a PR and told git to:
* soft reset my last commit (A)
* stash commit A
* hard reset commits (B, C, D)
* stash pop commit A
* add all files and commit
* force push to origin

I thought I branched from the wrong starting point and was trying to correct that mistake. I was wrong. I was not in the correct branch and now just destroyed 3 commits (B, C, D) and removed them from origin.

Bugger!

With some help from my colleagues and some quick google searches I found the `git reflog` command. It shows the history of what you've done to your branch including resets. It only took a few seconds to find the SHA1 just before everything went wong.

Action Plan:
* backup currently busted branch
* hard reset back to identified SHA1
* force push to origin
* switch to backup branch
* soft reset commit A
* stash commit A
* switch to correct branch
* stash pop commit A
* profit?

All told it took me longer to write this post than it did to fix my mistake and my Friday afternoon wasn't doomed; that made me smile.