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

With some help from my colleagues and 
