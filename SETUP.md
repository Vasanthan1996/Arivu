# Arivu website: how to update your live site

This folder is the complete website. It replaces what is in your GitHub repository today.

```
index.html     the whole site (pages, courses, styles, scripts)
img/           course and hero photos
favicon.svg    browser-tab icon (the Arivu logo)
robots.txt     tells Google it may index the site
sitemap.xml    helps Google find the site
SETUP.md       this guide (safe to keep in the repo)
```

## 1. Put it on GitHub (Vercel redeploys by itself)

1. Open your repository on github.com.
2. Click **Add file → Upload files**.
3. Drag in everything from this folder: `index.html`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `SETUP.md` and the whole `img` folder.
4. Click **Commit changes**.

Vercel picks up the commit and the new site is live at https://arivu-six.vercel.app in about a minute.
If your repository keeps the site inside a subfolder, upload into that same subfolder.

## 2. Fill in your contact details

Open `index.html` on GitHub (pencil icon to edit) and search for `const CONFIG`. It is near the top of the script:

```js
const CONFIG={
  siteUrl:"https://arivu-six.vercel.app/",
  leadWebhook:"",          // Google Sheet link from step 3
  whatsapp:"",             // e.g. "919876543210": country code + number, digits only
  phone:"",                // e.g. "+91 98765 43210"
  email:"",                // e.g. "admissions@arivu.in"
  campuses:[["Puducherry campus","Full address coming soon"],["Villupuram campus","Full address coming soon"]]
};
```

Anything left empty stays hidden. When you fill in `whatsapp`, "Chat on WhatsApp" buttons appear on the demo form, brochure, contact page and footer.
If you move to your own domain, also change `siteUrl`, and the address in `robots.txt`, `sitemap.xml` and the `<head>` of `index.html`.

## 3. Receive every lead in a Google Sheet (recommended)

Brochure downloads, demo bookings and contact messages are collected in the browser. To receive them, connect a Google Sheet:

1. Create a new Google Sheet, for example "Arivu Leads".
2. Click **Extensions → Apps Script**, delete what is there and paste this:

```js
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Leads") || ss.insertSheet("Leads");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Received", "Name", "Email", "WhatsApp", "Program", "Source", "Message", "Page"]);
  }
  const d = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), d.name, d.email, "+91 " + d.phone, d.course, d.src, d.message || "", d.page]);
  // Optional: email yourself for every lead (replace the address, then remove the two slashes)
  // MailApp.sendEmail("you@example.com", "New Arivu lead: " + d.name, d.course + " · " + d.src + " · +91 " + d.phone);
  return ContentService.createTextOutput("ok");
}
```

3. Click **Deploy → New deployment**, choose type **Web app**, set *Execute as* **Me** and *Who has access* **Anyone**, then **Deploy** and allow access.
4. Copy the Web app URL (it ends in `/exec`) and paste it into `leadWebhook` in `index.html`. Commit.

From then on every form on the live site adds a row to the sheet. Leads are only sent from the live site, not from the preview.

## 4. Change courses, syllabus or durations

All programs are in the `COURSES` list in `index.html`. Each module looks like this:

```js
["Docker for ML", 8, ["Images, containers and Dockerfiles", "Multi-stage builds", "..."], "Containerise the model API"]
//  module title  hrs   topics                                                          hands-on lab
```

- Total live hours are added up from the modules automatically, so they always match the syllabus.
- `weeks` is the program length. Keep it at 16 or less (4 months). 8 weeks or more shows as months; under 8 shows as weeks.
- The brochure, course page, batch tables and certificate all update from this one list.

## 5. Batch dates

Batch dates roll forward by themselves: each program gets a weekday batch and a weekend batch every 4 weeks, so the site never shows a date in the past. The `o` value (0 to 3) on each course shifts which week its batches start. If you would rather type exact dates, ask and this can be switched to a fixed list.

## 6. Photos

Replace any file in `img/` with your own photo using the **same file name** (JPG, about 1600px wide, under 300 KB). Real photos of your classrooms, trainers and students work best.
Trainer photos appear automatically when you add square photos with these names to `img/`: `trainer-vv.jpg` (V. Vasanthan), `trainer-rk.jpg` (Rajkumar), `trainer-sa.jpg` (Sandhosh), `trainer-gk.jpg` (Gokul). Until then the initials badge is shown. You can preview any photo first in Admin → Site photos (that preview lasts until the page reloads).

## 7. Before you give logins to real students

The student portal and admin panel are a working demo. Accounts live only in the visitor's browser and the sample passwords can be read in the page source, so do not put real student data in them yet. The next step is a real login and database (for example Supabase or Firebase), which can be added without changing the design.

## 8. Claims on the site

The site states that Arivu is the first institute in Pondicherry and Villupuram to introduce MLOps, Full-Stack AI and Supply Chain Analytics, and offers a globally recognised certificate. Keep evidence for both (for example, launch dates and the certifying body), because advertising rules (ASCI) expect "first" and "globally recognised" claims to be provable.
