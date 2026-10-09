# Arivu website + portal: setup guide

This folder is the complete website plus the backend for the student, faculty and admin portal.
Your Google Sheet is the database. Everything runs on free Google and Vercel plans.

```
index.html            the website and the portal
img/                  photos
favicon.svg           browser-tab icon
robots.txt, sitemap.xml
apps-script/Code.gs   the backend. This goes into your Google Sheet, NOT into GitHub
SETUP.md              this guide
```

Do the steps in this order. Step 1 must be finished before step 2. Otherwise the new website will talk to the old script, and logins will fail.

---

## 1. Update the Google Apps Script (about 5 minutes)

Your website already points to your existing script URL (`…/macros/s/AKfycbxP9TX…/exec`). We keep that URL and only replace the code behind it.

1. Open your Google Sheet, then click **Extensions → Apps Script**.
2. Open `Code.gs`, select everything (Ctrl+A) and delete it.
3. Open `apps-script/Code.gs` from this folder in Notepad, copy everything, and paste it into the editor.
4. Near the top, change the first admin login:
   ```js
   var SETUP_ADMIN={name:"Admin",email:"admin@arivu.in",password:"Change-Me-123"};
   ```
   Use your own email and a strong password.
5. Click **Save** (disk icon).
6. In the toolbar's function dropdown, choose **setup**, then click **Run**. Google asks for permission the first time: click **Review permissions**, choose your account, then **Advanced → Go to (project) → Allow**.
   The log should say *"Admin account created for …"*. Your Sheet now has these tabs:
   Users, Sessions, Batches, Enrollments, Attendance, Topics, Recordings, Notes, Events, Leaves, Certificates, Leads.
   Existing leads stay where they are. A Status column is added.
7. Publish the new code **without changing the URL**:
   **Deploy → Manage deployments → pencil icon (Edit) → Version: New version → Deploy**.
   Keep *Execute as: Me* and *Who has access: Anyone*.

> Do not use "New deployment". That creates a different URL, and the website would no longer reach your Sheet.
> If you ever do get a new URL, paste it into `api:` in `index.html` (search for `const CONFIG`).

**Check it works:** open your `/exec` URL in a browser. You should see `{"ok":true,"service":"Arivu portal API",…}`.

## 2. Upload the website to GitHub (Vercel redeploys by itself)

1. Open your repository on github.com, then click **Add file → Upload files**.
2. Drag in `index.html`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `SETUP.md` and the `img` folder. **Don't upload `apps-script`**; it isn't needed on the website.
3. Click **Commit changes**. The site updates at https://arivu-six.vercel.app in about a minute.

## 3. First login and daily use

Go to **arivu-six.vercel.app → Log in** with the admin email and password from step 1, then change your password under **Profile**.

**Admin (full access)**
- **Faculty → Add faculty**: name, email, WhatsApp and a temporary password. Share the login with them on WhatsApp.
- **Batches → New batch**: program, faculty, class days, timings, start date, and the Zoom or Google Meet link with the meeting ID and passcode.
- **Students → Add student**: creates the login and enrols the student in a batch. Each student gets an ID like ARV-2026-0001.
- **Recordings & notes**: paste Google Drive links for class videos and study material.
- **Holidays & notices**: holidays for all batches or one batch, notices, cancelled or extra classes.
- **Leave requests**: approve or reject faculty leave. Approved leave shows students "No class" on those dates.
- **Progress & topics**: set progress, completion status and remarks.
- **Certificates → Issue certificate**: choose the student and program, then the grade and date. The student can download it straight away.
- **Remove** takes away someone's access immediately. **Restore** gives it back. History is never deleted.

**Faculty** (only their own batches): mark attendance, record topics covered, update student progress, see the syllabus, post batch notices, and apply for leave.

**Students**: dashboard with next class and a Join button, timings and meeting link, attendance calendar, recordings, notes, topics covered and progress, notices and holidays, and certificate download (PDF or image).

**Anyone**: can check a certificate number at **arivu-six.vercel.app/#verify**. The number is printed on every certificate.

Only admins can create or remove accounts, and there is no public sign-up. To make a second admin, create them as faculty, then change their `role` cell in the **Users** tab of the Sheet from `faculty` to `admin`.

## 4. Class recordings from Google Drive

1. Upload the class video to Google Drive. A shared folder per batch keeps things tidy.
2. Right-click the video, then **Share**:
   - General access: **Anyone with the link → Viewer**
   - Click the gear icon (⚙) and **untick "Viewers and commenters can see the option to download, print and copy"**.
3. Copy the link and paste it in **Admin → Recordings & notes → Add recording**.

Students watch it inside the portal with their name moving across the video. The Drive "open in new window" button is blocked, and right-click is disabled on the player.

**Be aware:** with "Anyone with the link", a student who finds the link in the browser's developer tools could share it. The name watermark discourages screen recording, but nothing on the web can fully stop it. For stricter control, share the video only with your students' Gmail addresses (General access: Restricted). Students then need to be signed in to that Gmail in the same browser for the video to play.
If a Drive video ever refuses to play inside the portal, set `videoSandbox:false` in `const CONFIG` in `index.html`.

YouTube **unlisted** links also work in the same field.

## 5. Settings in index.html

Search for `const CONFIG` in `index.html`:

```js
api:"https://script.google.com/macros/s/…/exec",   // your Apps Script URL (already set)
whatsapp:"",       // e.g. "919876543210" adds WhatsApp buttons
phone:"", email:"",
campuses:[["Puducherry campus","Full address coming soon"],["Villupuram campus","Full address coming soon"]]
```

## 6. Good to know

- **Keep the Google Sheet private.** It holds every student's details and the password hashes. Never share it with "Anyone with the link". Passwords themselves are never stored, only salted, hashed versions.
- **Five wrong passwords** lock that email for 15 minutes. Forgotten password: Admin → Students or Faculty → Edit → set a new password.
- **Sessions** last 7 days on a device. Logging out ends the session.
- **Speed and limits:** each portal action takes about 1–3 seconds, because Google runs the script fresh each time. Free Google accounts allow about 30 portal actions at the same moment, which suits a few hundred active students. If you grow into the thousands, the same portal can move to a proper database later.
- **Backups:** File → Make a copy of the Sheet now and then, or use File → Version history.
- **Editing data directly:** you can fix a typo in the Sheet, but don't rename the column headers or the tabs.
- **Course content** (syllabus, durations, photos) is still edited in `index.html`. See the `COURSES` list.

## 7. Claims on the site

Keep evidence for "first institute in Pondicherry & Villupuram" and "globally recognised certificate" (launch dates, the certifying body), and get written approval from SRM Infotech to print "In collaboration with SRM Infotech, Pondicherry" on certificates. Advertising rules (ASCI) expect claims like these to be provable.
