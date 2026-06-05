# How to Upload to GitHub (Drag & Drop — No Git Required)

## Step 1: Create a GitHub Account (skip if you already have one)

1. Go to **https://github.com**
2. Click **Sign up** and follow the prompts
3. Verify your email

## Step 2: Create a New Repository

1. Click the **+** button (top-right corner) → **New repository**
2. Fill in:
   - **Repository name:** `inventory-dashboard-desktop`
   - **Description:** `Offline Inventory Reconciliation Dashboard — Windows Desktop App`
   - **Visibility:** Public (or Private if you prefer)
   - ⚠️ Do **NOT** check "Add a README file" (we already have one)
   - ⚠️ Do **NOT** check "Add .gitignore" (we already have one)
3. Click **Create repository**

## Step 3: Upload Files (Drag & Drop)

After creating the repo, you'll see a quick setup page:

1. Click **"uploading an existing file"** link (or go to your repo → **Add file** → **Upload files**)
2. Open your file explorer and navigate to:
   ```
   C:\Users\chenh\Kiro projects\HTMLS\inventory-dashboard-desktop\
   ```
3. Select **ALL** files and folders inside this folder:
   - `.github/` (folder)
   - `app/` (folder)
   - `build/` (folder)
   - `scripts/` (folder)
   - `.gitignore`
   - `LICENSE`
   - `main.js`
   - `package.json`
   - `preload.js`
   - `README.md`
   - `UPLOAD_GUIDE.md`
4. **Drag them all** into the upload area on the GitHub page
5. Wait for all files to upload (progress bar will show)
6. Scroll down, write a commit message like: `Initial upload`
7. Click **Commit changes**

> ⚠️ **Note:** GitHub web upload has a limit of ~100 files at a time. If it complains, upload in batches (e.g., `app/` folder contents first, then the rest).

## Step 4: Verify Upload

1. Go to your repository page
2. You should see all files listed with the README displayed below
3. Click into `app/`, `build/`, `.github/` to make sure subfolders uploaded correctly

## Step 5: Trigger the Build (Get Your .exe)

### Option A: Manual trigger (recommended for first time)
1. Go to your repo → **Actions** tab
2. Click **"Build Windows EXE"** on the left
3. Click **"Run workflow"** → **"Run workflow"** (green button)
4. Wait ~3-5 minutes for the build to complete (green checkmark)
5. Click into the completed workflow run
6. Scroll to **Artifacts** section at the bottom
7. Download **"InventoryDashboard-portable-exe"** — that's your `.exe`!

### Option B: Create a Release (auto-triggers build)
1. Go to your repo → **Releases** (right sidebar) → **Create a new release**
2. Click **"Choose a tag"** → type `v1.0.0` → click **"Create new tag: v1.0.0 on publish"**
3. **Release title:** `v1.0.0 — Initial Release`
4. **Description:** `First release of the Inventory Dashboard desktop app.`
5. Click **Publish release**
6. The GitHub Actions workflow will automatically build the `.exe` and attach it to this release
7. After ~3-5 minutes, refresh the release page — the `.exe` will appear under **Assets**

## Step 6: Share the Download Link

Once the release has the `.exe` attached:
- Direct others to: `https://github.com/YOUR_USERNAME/inventory-dashboard-desktop/releases/latest`
- They can download the portable `.exe` and run it immediately — no installation needed

## Updating the App Later

When you make changes:
1. Go to your repo on GitHub
2. Navigate to the file you changed
3. Click the **pencil icon** (Edit) to edit directly on GitHub
4. Or use **Add file → Upload files** to replace files
5. Create a new tag/release to trigger a fresh `.exe` build

---

That's it! Your app is now hosted on GitHub with automated builds. 🎉
