# SafeMigration Plan - SimpliFinance

## Current Situation
- **Old Production**: Working on `simplifinance-65ac9` project
- **Users**: Jack can login, others may need password resets
- **Domain**: simplifinancellc.com points to old project (working)
- **Root folder**: Currently pointing to OLD project (needs to change)

## STEP 1: Project Separation (SAFE)
1. Switch root folder to NEW project: `simplifinancellc-a6795`
2. Keep old-production folder on OLD project: `simplifinance-65ac9`
3. Test new project thoroughly BEFORE any domain changes

## STEP 2: Cleanup (LOW RISK)
1. Create `migration-temp/` folder for all debug files
2. Move all `*.json`, `*scrypt*.js`, `*debug*.js` files there
3. Keep workspace clean

## STEP 3: New Project Setup (SAFE)
1. Deploy new project to its own URL first
2. Test all functionality on new URL
3. Set up user accounts with fresh passwords
4. Only switch domain AFTER everything works

## STEP 4: Domain Migration (ONLY WHEN READY)
1. Test new project at `simplifinancellc-a6795.web.app`
2. If working: point simplifinancellc.com to new project
3. Keep old project as fallback

## ROLLBACK PLAN
- old-production/ folder remains untouched
- Can always revert domain back to old project
- No changes to working authentication

## RISK MITIGATION
- Never touch old-production folder
- Test everything on Firebase URLs before domain changes
- Keep backups of all configs
- Users can reset passwords on new project if needed

---
**GOLDEN RULE: OLD PROJECT STAYS WORKING UNTIL NEW PROJECT IS 100% READY**