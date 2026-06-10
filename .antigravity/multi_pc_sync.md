# Multi-PC Sync Instructions for Antigravity

This directory contains the context files for features implemented or planned in this project, organized cleanly into feature-specific subfolders.

## 📂 Required Folder Structure & Files

For each feature folder under `.antigravity/`, ensure the following files are present and maintained:
1. **Original Feature Specification:** The original unified feature description file (e.g., `star_feature.md`, `uptrend_pullback_feature.md`). Do **NOT** delete or replace this file.
2. **Implementation Plan (`implementation_plan.md`):** The technical plan, algorithm design, and proposed changes.
3. **Task Checklist (`task.md`):** The list of checkbox tasks marking development progress.
4. **Walkthrough (`walkthrough.md`):** The summary of final code modifications and verification tests.

When switching between computers, copy and paste the prompt below to initialize a new session so the other PC's agent is aware of the structure.

---

## 📋 Session Initialization Prompt

Copy and paste this prompt when starting a new chat session with Antigravity on a different machine:

```text
I am pair programming with you across two PCs. I've pulled the latest changes from Git. Please explore the subfolders inside the `.antigravity/` directory recursively to find our active features (under `golden_star_setup/` and `uptrend_pullback_setup/`), codebase reorg logs (under `codebase_reorganization/`), and general ideas (under `general/`). Going forward, when we implement or update features, ensure we maintain both the original unified feature markdown specifications (e.g., `*_feature.md`) and the structured plans, tasks, and walkthroughs (`implementation_plan.md`, `task.md`, `walkthrough.md`) inside a feature-specific subfolder in `.antigravity/` and commit them to Git.
```

