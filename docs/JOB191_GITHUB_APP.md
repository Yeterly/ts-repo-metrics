# Job191 GitHub App: setup and installation

Job191 reads each team's repository through a GitHub App. This replaces the earlier GitHub OAuth app, which asked every student for read and write access to all of their repositories.

| | Before (OAuth app) | Now (GitHub App) |
| --- | --- | --- |
| What the student approves | Read and write access to every repository they can reach | Their GitHub username only |
| Which repositories the site can read | All of the student's repositories | Only repositories a team installed the app on |
| Access level | Read and write | Read-only: contents, pull requests, checks, commit statuses |
| Tokens stored | Each student's GitHub token, encrypted | None; the server asks GitHub for a one-hour token when it needs one |

How it works:

1. A student signs in to job191.yeterly.ai and clicks **Connect GitHub**. GitHub only confirms their username.
2. One member of each team installs the app on the team's repository.
3. When a student adds a pull request, the server checks that the app is installed on that repository and that the student's GitHub account has write access to it. Then it reads the pull request with a short-lived, read-only token scoped to that one repository.

Part 1 is done once by course staff. Part 4 is the student guide; share it with the class.

---

## Part 1: Create the GitHub App (course staff, once)

You need to be an owner of the Yeterly GitHub organization.

1. Open **https://github.com/organizations/Yeterly/settings/apps/new**. (Or: Yeterly organization → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.)
2. **Register new GitHub App**:
   - **GitHub App name:** `Job191 Repo Metrics`. GitHub turns this into the app's *slug*, `job191-repo-metrics`, which appears in its links. If the name is taken, choose another and note the slug GitHub shows after creating it.
   - **Description:** `Reads Job191 team repositories to check sprint task pull requests. Read-only; never changes your repository.`
   - **Homepage URL:** `https://job191.yeterly.ai`
3. **Identifying and authorizing users**:
   - **Callback URL:** `https://xdfumeeevblufylojwvb.supabase.co/auth/v1/callback`
   - **Expire user authorization tokens:** leave it checked. The site never keeps these tokens.
   - **Request user authorization (OAuth) during installation:** leave it unchecked.
   - **Enable Device Flow:** leave it unchecked.
4. **Post installation**:
   - **Setup URL:** `https://job191.yeterly.ai/dashboard`
   - Check **Redirect on update**, so students return to the dashboard after installing or changing the app.
5. **Webhook:** uncheck **Active**. The site does not use webhooks.
6. **Permissions**. Set exactly these and leave everything else at *No access*:

   | Section | Permission | Access | Used for |
   | --- | --- | --- | --- |
   | Repository | Contents | Read-only | Task spec files, diffs, tags |
   | Repository | Pull requests | Read-only | The pull request, its commits, files and review comments |
   | Repository | Checks | Read-only | CI results on the merge commit |
   | Repository | Commit statuses | Read-only | CI results reported as statuses |
   | Repository | Metadata | Read-only | Required by GitHub; also used to check a student has write access |
   | Account | Email addresses | Read-only | Supabase reads the email of the GitHub account when a student connects it |

7. **Where can this GitHub App be installed?** Choose **Any account**. Student teams keep their repositories in their own accounts or organizations, not in Yeterly's.
8. Click **Create GitHub App**.

### Collect the app's credentials

On the app's settings page (**Settings** → **Developer settings** → **GitHub Apps** → **Job191 Repo Metrics** → **General**):

1. Note the **App ID** (a number) and the **Client ID** (starts with `Iv`).
2. Under **Client secrets**, click **Generate a new client secret** and copy it. GitHub shows it only once.
3. Under **Private keys**, click **Generate a private key**. GitHub downloads a `.pem` file. Keep it somewhere safe and never commit it.
4. Optionally, upload a logo under **Display information** so students recognize the app.

---

## Part 2: Use the app for GitHub sign-in in Supabase (course staff, once)

Students' **Connect GitHub** button goes through Supabase's GitHub provider. Point it at the new app:

1. Supabase dashboard → project **Job191** → **Authentication** → **Sign In / Providers** → **GitHub**.
2. Replace **Client ID** with the app's Client ID (`Iv…`) and **Client Secret** with the client secret from Part 1. Click **Save**.
3. On the same page, check that **Allow manual linking** is still on. Students link GitHub to the account they signed in with.

Students who connected GitHub through the old OAuth app stay linked. GitHub identifies them by the same account, so they don't need to connect again.

---

## Part 3: Configure and deploy the site (course staff, once)

The web app needs the App ID, the slug and the private key. Run these in Git Bash from the repository root, signed in with `az`:

```bash
# The private key goes in as a Container Apps secret, base64-encoded onto one line.
az containerapp secret set -n job191-web -g job191-rg \
  --secrets "github-app-private-key=$(base64 -w0 /path/to/job191-repo-metrics.private-key.pem)"

az containerapp update -n job191-web -g job191-rg \
  --set-env-vars GITHUB_APP_ID=<App ID> GITHUB_APP_SLUG=job191-repo-metrics \
                 GITHUB_APP_PRIVATE_KEY=secretref:github-app-private-key
```

Then deploy the code that uses the app:

```bash
bash apps/dashboard/scripts/deployJob191.sh
```

The grading worker does not read GitHub, so it needs none of these settings.

**Check:** sign in, open https://job191.yeterly.ai/dashboard, and look for the **Install or check it** link under a pull request field. It should open `https://github.com/apps/job191-repo-metrics/installations/new`. If the link is missing, `GITHUB_APP_SLUG` is not set on `job191-web`.

### Retire the old OAuth app

When the new app works:

1. Delete the old OAuth app: Yeterly organization → **Settings** → **Developer settings** → **OAuth Apps** → **Job191 Repo Metrics** → **Delete application**. This revokes every token it issued.
2. Remove the GitHub tokens the site stored while it used the OAuth app. In the Supabase SQL editor:

   ```sql
   delete from public.user_github_tokens;
   ```

---

## Part 4: Install the app on your team's repository (students)

Each team does this **once**, and only **one** team member needs to do it. That person must be able to manage the repository: its owner, or an owner of the organization it belongs to.

### Step 1: Connect your GitHub account (every student)

1. Sign in at **https://job191.yeterly.ai/dashboard** and join the course with the course code.
2. Click **Connect GitHub** and approve. GitHub only shares your username with Job191; this step gives no access to your repositories.

Every team member who submits pull requests must also have **write access** to the team repository: added as a collaborator, or a member of an organization team with write access. You need it anyway to push your task branches. The site checks it to make sure students only submit from their own team's repository.

### Step 2: Install the app (one team member)

1. Open **https://github.com/apps/job191-repo-metrics/installations/new**, or click **Install or check it** on the dashboard.
2. Choose the account that owns your team's repository: your personal account, or your team's organization.
3. Choose **Only select repositories**, and select your team's project repository. Do not choose *All repositories*.
4. Check the permissions GitHub lists. They should all be read-only: contents, pull requests, checks, commit statuses and metadata.
5. Click **Install**. GitHub brings you back to the Job191 dashboard.

**If your repository is in an organization you don't own:** the button says **Request** instead of **Install**. Click it. GitHub then asks the organization's owners to approve. Ask an owner to open the organization's **Settings** → **GitHub Apps** → **Pending GitHub App installation requests** and approve **Job191 Repo Metrics**, limited to your team's repository.

### Step 3: Add your pull requests

Paste each merged task pull request link on the dashboard and click **Add PR**. If something is not set up yet, the dashboard says what to fix:

| Message | What to do |
| --- | --- |
| *The Job191 GitHub App is not installed on team/repo* | Do Step 2, or ask your organization owner to approve the request. |
| *Your GitHub account @name cannot push to team/repo* | Ask the repository owner to give you write access: repository **Settings** → **Collaborators** (or **Collaborators and teams**) → **Add people**, with the *Write* role. Or check you connected the right GitHub account. |
| *Connect GitHub before submitting* | Do Step 1. |
| *GitHub access is not set up on this site yet* | Tell your instructor (Part 3 is incomplete). |

### Changing or removing the app

- **Add or change repositories:** GitHub → your profile picture → **Settings** → **Applications** → **Installed GitHub Apps** → **Job191 Repo Metrics** → **Configure**. For an organization, use the organization's **Settings** → **GitHub Apps**.
- **Remove it after the course:** on the same page, click **Uninstall**. Grades and feedback already saved on Job191 are not affected.

---

## Troubleshooting (course staff)

- **"Error getting user email from external provider" when connecting GitHub:** the app is missing the Account permission **Email addresses: Read-only** (Part 1, step 6). After adding a permission, GitHub asks each installation to accept it; students who already installed the app see the request under the app's **Configure** page.
- **Every repository reports "not installed":** check `GITHUB_APP_ID` and the private key on `job191-web`. A wrong key makes GitHub reject the app's requests. Regenerate the key if needed and set the secret again.
- **"Request" never gets approved:** organization owners sometimes miss GitHub's email. They can approve from the organization's **Settings** → **GitHub Apps** at any time.
- **A student's pull request is in a fork:** submit the pull request from the team repository that has the app installed. The app can only read repositories it is installed on.
