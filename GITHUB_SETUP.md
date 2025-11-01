# GitHub Setup Guide

## ✅ Git Repository Initialized

Your local Git repository has been created with:
- **32 files** committed
- **10,694 lines** of code
- **Branch**: main
- **Commit**: Initial commit with full PsychoHistory implementation

---

## 🚀 Push to GitHub (2 Options)

### Option 1: GitHub CLI (Recommended - Fastest)

If you have GitHub CLI installed:

```bash
# Create repo and push in one command
gh repo create PsychoHistory --public --source=. --push

# Or for private repo
gh repo create PsychoHistory --private --source=. --push
```

Done! Your repo will be at: `https://github.com/YOUR_USERNAME/PsychoHistory`

---

### Option 2: Manual Setup

#### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: **PsychoHistory**
3. Description: *Probabilistic event forecasting system powered by LLM and historical research*
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

#### Step 2: Push Your Code

```bash
# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/PsychoHistory.git

# Push to GitHub
git push -u origin main
```

---

## 🔐 Important: Verify API Keys Are NOT Committed

Your `.env.local` file (containing API keys) is properly ignored. Verify:

```bash
# This should show NO results
git log --all --full-history -- .env.local
```

✅ **Confirmed**: API keys are safe and not in git history

---

## 📋 Repository Description (for GitHub)

Copy this for your GitHub repo description:

```
Probabilistic event forecasting system that generates trees of possible outcomes
using LLM analysis and historical research. Built with Next.js, React Flow,
OpenRouter (GPT-4o), and Exa AI. Inspired by Asimov's Foundation series.
```

---

## 🏷️ Suggested Topics (Tags)

Add these topics to your GitHub repo:

```
nextjs
typescript
react-flow
openrouter
llm
probability
forecasting
data-visualization
d3
tailwindcss
hackathon
psychohistory
gpt-4
event-prediction
```

---

## 📄 Repository Settings

### Recommended Settings:

1. **About section**:
   - Website: `https://psychohistory.vercel.app` (after deployment)
   - Topics: (see above)
   - [x] Releases
   - [x] Packages
   - [x] Deployments

2. **Features**:
   - [x] Issues
   - [ ] Projects (optional)
   - [x] Wiki (optional - for documentation)
   - [x] Discussions (optional - for community)

3. **Branch protection** (optional for main):
   - Require pull request reviews
   - Require status checks

---

## 🚀 Deploy to Vercel (Optional)

After pushing to GitHub:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to GitHub repo: Yes
# - Set environment variables:
#   - OPENROUTER_API_KEY
#   - SEARCH_PROVIDER
#   - EXA_API_KEY
```

Or use Vercel Dashboard:
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables
4. Deploy!

---

## 🔗 Quick Commands Reference

```bash
# Check git status
git status

# View commit history
git log --oneline

# Create a new branch
git checkout -b feature/new-feature

# Push changes
git add .
git commit -m "Description of changes"
git push

# Pull latest changes
git pull origin main

# View remote URL
git remote -v
```

---

## 📊 Repository Stats

**Current State**:
- Commits: 1
- Branches: 1 (main)
- Files: 32
- Lines of code: ~10,694
- Languages: TypeScript (95%), CSS (3%), JavaScript (2%)

---

## 🎯 Next Steps After Pushing

1. ✅ Add repository description and topics
2. ✅ Star your own repo (why not? 😄)
3. ✅ Enable GitHub Pages (optional - for documentation)
4. ✅ Set up GitHub Actions (optional - CI/CD)
5. ✅ Add issue templates
6. ✅ Create a demo video/GIF
7. ✅ Deploy to Vercel
8. ✅ Share with community!

---

## 🐛 Troubleshooting

### "Repository not found" error

Make sure the repository exists on GitHub and the URL is correct:

```bash
git remote -v
# Should show: origin  https://github.com/YOUR_USERNAME/PsychoHistory.git
```

### Authentication issues

If using HTTPS, you may need a Personal Access Token:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Use token as password when pushing

Or switch to SSH:
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/PsychoHistory.git
```

### Large file errors

All node_modules are ignored, so this shouldn't happen. If it does:

```bash
# Check large files
find . -type f -size +50M

# If needed, add to .gitignore
echo "large-file.zip" >> .gitignore
```

---

## 🎉 You're All Set!

Your PsychoHistory project is now version controlled and ready to share with the world!

Repository checklist:
- [x] Git initialized
- [x] Initial commit created
- [x] .gitignore configured
- [x] API keys protected
- [ ] Pushed to GitHub (run command above)
- [ ] Repository description added
- [ ] README.md visible on GitHub
- [ ] Deployed to Vercel (optional)

**Happy forecasting! 🔮**
