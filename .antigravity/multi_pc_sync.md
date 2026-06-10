# Multi-PC Sync Instructions for Antigravity

This directory contains the context files for features implemented or planned in this project, organized cleanly into feature-specific subfolders.

When switching between computers, copy and paste the prompt below to initialize a new session so the other PC's agent is aware of the structure.

---

## 📋 Session Initialization Prompt

Copy and paste this prompt when starting a new chat session with Antigravity on a different machine:

```text
I am pair programming with you across two PCs. I've pulled the latest changes from Git. Please explore the subfolders inside the `.antigravity/` directory recursively to find our active features (under `golden_star_setup/` and `uptrend_pullback_setup/`), codebase reorg logs (under `codebase_reorganization/`), and general ideas (under `general/`). Going forward, when we implement new features that generate markdown plans, tasks, or walkthroughs, save those files inside a feature-specific subfolder in `.antigravity/` and add them to the list of changes to be committed so that both machines stay in sync.
```
