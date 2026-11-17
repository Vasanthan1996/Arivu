/* Arivu Institute portal backend for Google Apps Script. Generated file: paste all of it into Code.gs. */
/* ===================== GOOGLE APPS SCRIPT ENTRY POINTS =====================
   1. Paste this whole file into Extensions → Apps Script of your Google Sheet (replace everything).
   2. Put your admin email and password in SETUP_ADMIN below, click Save, choose "setup" in the toolbar and click Run.
   3. Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy. The /exec URL stays the same.
   Can't log in as admin? Check SETUP_ADMIN, click Save, choose "resetAdmin" in the toolbar and click Run.
   It creates that admin (or resets its password) and lists every admin account in the Execution log. */
var SETUP_ADMIN={name:"Admin",email:"admin@arivu.in",password:"Change-Me-123"};
var ARIVU_TZ="Asia/Kolkata";

function doPost(e){
  var q={};
  try{q=JSON.parse(e&&e.postData&&e.postData.contents||"{}")}catch(x){}
  if(!q.action&&q.name)q.action="lead";               // forms from the older website version
  return arivuOut(arivuApp().handle(q));
}
function doGet(e){
  var p=(e&&e.parameter)||{};
  if(p.verify)return arivuOut(arivuApp().handle({action:"verify",certNo:p.verify}));
  return arivuOut({ok:true,service:"Arivu portal API",time:Utilities.formatDate(new Date(),ARIVU_TZ,"yyyy-MM-dd HH:mm")});
}
/* Run once from the editor (select "setup" → Run). Safe to run again: it never deletes data. */
function setup(){
  var msg=arivuCore(arivuDB(arivuGrid(SpreadsheetApp.getActiveSpreadsheet()),ARIVU_SCHEMA),arivuEnv()).setup(SETUP_ADMIN);
  Logger.log(msg);return msg;
}
/* Run from the editor if the admin login fails: creates the SETUP_ADMIN account or resets its password. */
function resetAdmin(){
  var msg=arivuCore(arivuDB(arivuGrid(SpreadsheetApp.getActiveSpreadsheet()),ARIVU_SCHEMA),arivuEnv()).resetAdmin(SETUP_ADMIN);
  Logger.log(msg);return msg;
}
function arivuApp(){return arivuCore(arivuDB(arivuGrid(SpreadsheetApp.getActiveSpreadsheet()),ARIVU_SCHEMA),arivuEnv())}
function arivuOut(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}

function arivuEnv(){
  var fmt=function(d,f){return Utilities.formatDate(d,ARIVU_TZ,f)};
  return{
    now:function(){return fmt(new Date(),"yyyy-MM-dd HH:mm")},
    today:function(){return fmt(new Date(),"yyyy-MM-dd")},
    nowPlus:function(days){return fmt(new Date(Date.now()+days*864e5),"yyyy-MM-dd HH:mm")},
    hash:function(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(function(b){return ((b+256)%256).toString(16).padStart(2,"0")}).join("")},
    uuid:function(){return Utilities.getUuid()},
    cacheGet:function(k){return CacheService.getScriptCache().get(k)},
    cachePut:function(k,v,s){CacheService.getScriptCache().put(k,v,s)},
    lock:function(fn){var l=LockService.getScriptLock();l.waitLock(20000);try{return fn()}finally{l.releaseLock()}}
  };
}
/* A sheet tab as a grid of text. Values are written with a leading apostrophe so Google Sheets
   keeps dates, times, phone numbers and IDs exactly as typed (and never runs them as formulas). */
function arivuGrid(ss){
  var tz=ss.getSpreadsheetTimeZone()||ARIVU_TZ;
  var norm=function(v){
    if(v instanceof Date){if(v.getFullYear()<1901)return Utilities.formatDate(v,tz,"HH:mm");var s=Utilities.formatDate(v,tz,"yyyy-MM-dd HH:mm");return / 00:00$/.test(s)?s.slice(0,10):s}
    if(v===null||v===undefined)return "";
    v=String(v);return v.charAt(0)==="'"?v.slice(1):v;
  };
  var txt=function(row){return row.map(function(v){return v===""?"":"'"+v})};
  return function(name,head){
    var sh=ss.getSheetByName(name);
    if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,head.length).setValues([head]).setFontWeight("bold");sh.setFrozenRows(1)}
    return{
      values:function(){return sh.getDataRange().getValues().map(function(r){return r.map(norm)})},
      setHeader:function(h){sh.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold")},
      appendRows:function(rows){var start=sh.getLastRow()+1;sh.getRange(start,1,rows.length,rows[0].length).setValues(rows.map(txt));return start},
      setRow:function(r,arr){sh.getRange(r,1,1,arr.length).setValues([txt(arr)])},
      deleteRow:function(r){sh.deleteRow(r)}
    };
  };
}

/* ===================== ARIVU PORTAL CORE =====================
   One copy of the business rules, shared by:
   - the Google Apps Script backend (your Google Sheet is the database)
   - the website's preview/demo mode
   Plain ES2019 so it runs on Apps Script V8 and in every browser. */
var ARIVU_SCHEMA={
  Users:["id","role","name","email","phone","passHash","salt","status","studentCode","createdAt","lastLogin"],
  Sessions:["token","userId","expires","createdAt"],
  Batches:["id","name","courseId","facultyId","kind","days","startTime","endTime","startDate","endDate","mode","meetingLink","meetingInfo","status","createdAt"],
  Enrollments:["id","studentId","batchId","courseId","status","progress","remark","enrolledAt","updatedAt"],
  Attendance:["id","batchId","date","studentId","status","markedBy","markedAt"],
  Topics:["id","batchId","date","module","topic","notes","facultyId","createdAt"],
  Recordings:["id","batchId","title","date","module","url","addedBy","createdAt"],
  Notes:["id","batchId","title","url","kind","date","addedBy","createdAt"],
  Events:["id","type","title","date","endDate","batchId","details","createdBy","createdAt"],
  Leaves:["id","userId","from","to","reason","status","decidedBy","decidedAt","createdAt"],
  Certificates:["id","certNo","studentId","courseId","batchId","issueDate","grade","status","issuedBy","createdAt"],
  Leads:["Received","Name","Email","WhatsApp","Program","Source","Message","Page","Status"]
};

/* Table access over a "grid" (a Google Sheet tab, or an in-memory array in demo mode) */
function arivuDB(open,schema){
  var cache={};
  function load(name){
    if(cache[name])return cache[name];
    var want=schema[name],g=open(name,want),v=g.values();
    var head=(v[0]||[]).map(function(x){return String(x).trim()});
    if(!head.length||head.every(function(h){return !h})){head=want.slice();g.setHeader(head)}
    var miss=want.filter(function(h){return head.indexOf(h)<0});
    if(miss.length){head=head.concat(miss);g.setHeader(head)}
    var rows=[];
    for(var i=1;i<v.length;i++){
      var r=v[i];if(r.every(function(x){return x===""||x===null||x===undefined}))continue;
      var o={_row:i+1};head.forEach(function(h,j){if(h)o[h]=r[j]===undefined||r[j]===null?"":String(r[j])});rows.push(o);
    }
    return cache[name]={g:g,head:head,rows:rows};
  }
  function toArr(t,o){return t.head.map(function(h){return o[h]===undefined||o[h]===null?"":String(o[h])})}
  return{
    all:function(name){return load(name).rows},
    insert:function(name,o){var t=load(name),r=t.g.appendRows([toArr(t,o)]),x=Object.assign({},o,{_row:r});t.rows.push(x);return x},
    insertMany:function(name,list){if(!list.length)return;var t=load(name),r=t.g.appendRows(list.map(function(o){return toArr(t,o)}));list.forEach(function(o,i){t.rows.push(Object.assign({},o,{_row:r+i}))})},
    update:function(name,row,patch){var t=load(name),x=t.rows.find(function(r){return r._row===row._row});if(!x)throw new Error("Row not found in "+name);Object.assign(x,patch);t.g.setRow(x._row,toArr(t,x));return x},
    remove:function(name,row){var t=load(name);t.g.deleteRow(row._row);t.rows=t.rows.filter(function(r){return r._row!==row._row});t.rows.forEach(function(r){if(r._row>row._row)r._row--})}
  };
}

function arivuCore(db,env){
  var SAFE=["id","role","name","email","phone","status","studentCode","createdAt","lastLogin"];
  var DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var PW_ROUNDS=300,SESSION_DAYS=7;
  function err(m){var e=new Error(m);e.user=true;return e}
  function S(v,max){return String(v===undefined||v===null?"":v).trim().slice(0,max||200)}
  var isDate=function(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)};
  var isTime=function(s){return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)};
  var isUrl=function(s){return /^https?:\/\/[^\s<>"]+$/i.test(s)};
  var okEmail=function(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)};
  function strip(r){var o={};for(var k in r)if(k!=="_row")o[k]=r[k];return o}
  function safeUser(u){var o={};SAFE.forEach(function(k){o[k]=u[k]===undefined?"":u[k]});return o}
  function byId(t,id){return db.all(t).find(function(r){return String(r.id)===String(id)})}
  function nextId(t,prefix){var max=0;db.all(t).forEach(function(r){var n=parseInt(String(r.id).replace(/\D/g,""),10);if(n>max)max=n});return prefix+String(max+1).padStart(4,"0")}
  function hashPw(pw,salt){var h=env.hash(salt+":"+pw);for(var i=0;i<PW_ROUNDS;i++)h=env.hash(h+salt);return h}
  function checkPw(pw){if(String(pw||"").length<6)throw err("The password needs at least 6 characters.")}
  function batchOf(id){var b=byId("Batches",id);if(!b)throw err("Batch not found.");return b}
  function ownBatch(u,batchId){var b=batchOf(batchId);if(u.role==="faculty"&&b.facultyId!==u.id)throw err("This batch isn't assigned to you.");return b}
  function needDate(d,label){if(!isDate(d))throw err("Choose a valid "+(label||"date")+".");return d}
  function link(u,label,required){u=S(u,500);if(!u&&!required)return "";if(!isUrl(u))throw err("Enter a full "+(label||"link")+" starting with https://");return u}

  /* ---------- Sessions ---------- */
  function sessionUser(token){
    if(!token)throw err("Please log in again.");
    var s=db.all("Sessions").find(function(r){return r.token===token});
    if(!s||s.expires<env.now())throw err("Your session has expired. Please log in again.");
    var u=byId("Users",s.userId);
    if(!u||u.status!=="active")throw err("This account is not active. Please log in again.");
    return u;
  }
  function dropSessions(userId){db.all("Sessions").filter(function(s){return s.userId===userId}).slice().forEach(function(s){db.remove("Sessions",s)})}
  function pruneSessions(){var now=env.now();db.all("Sessions").filter(function(s){return s.expires<now}).slice(0,25).forEach(function(s){db.remove("Sessions",s)})}

  /* ---------- What each role can see ---------- */
  function boot(u){
    var users=db.all("Users"),batches=db.all("Batches"),enr=db.all("Enrollments").filter(function(e){return e.status!=="removed"});
    var att=db.all("Attendance"),topics=db.all("Topics"),recs=db.all("Recordings"),notes=db.all("Notes"),events=db.all("Events"),leaves=db.all("Leaves"),certs=db.all("Certificates");
    var nameOf=function(id){var x=users.find(function(r){return r.id===id});return x?x.name:""};
    var inB=function(ids){return function(r){return ids.indexOf(r.batchId)>=0}};
    var base={me:safeUser(u),serverToday:env.today()};
    if(u.role==="admin"){
      return Object.assign(base,{users:users.map(safeUser),batches:batches.map(strip),enrollments:enr.map(strip),attendance:att.map(strip),topics:topics.map(strip),
        recordings:recs.map(strip),notes:notes.map(strip),events:events.map(strip),leaves:leaves.map(strip),certificates:certs.map(strip),
        leads:db.all("Leads").slice(-400).reverse().map(function(r){return Object.assign(strip(r),{id:r._row})})});
    }
    if(u.role==="faculty"){
      var my=batches.filter(function(b){return b.facultyId===u.id}),ids=my.map(function(b){return b.id});
      var en=enr.filter(inB(ids)),sIds=en.map(function(e){return e.studentId});
      return Object.assign(base,{batches:my.map(strip),enrollments:en.map(strip),
        users:[safeUser(u)].concat(users.filter(function(x){return sIds.indexOf(x.id)>=0}).map(function(x){return{id:x.id,role:x.role,name:x.name,studentCode:x.studentCode,phone:x.phone,email:x.email,status:x.status}})),
        attendance:att.filter(inB(ids)).map(strip),topics:topics.filter(inB(ids)).map(strip),recordings:recs.filter(inB(ids)).map(strip),notes:notes.filter(inB(ids)).map(strip),
        events:events.filter(function(e){return !e.batchId||ids.indexOf(e.batchId)>=0}).map(strip),
        leaves:leaves.filter(function(l){return l.userId===u.id}).map(strip)});
    }
    var mine=enr.filter(function(e){return e.studentId===u.id}),bIds=mine.map(function(e){return e.batchId});
    var myB=batches.filter(function(b){return bIds.indexOf(b.id)>=0}).map(function(b){return Object.assign(strip(b),{facultyName:nameOf(b.facultyId)})});
    var fac=myB.map(function(b){return b.facultyId});
    return Object.assign(base,{enrollments:mine.map(strip),batches:myB,
      attendance:att.filter(function(a){return a.studentId===u.id}).map(strip),
      topics:topics.filter(inB(bIds)).map(strip),recordings:recs.filter(inB(bIds)).map(strip),notes:notes.filter(inB(bIds)).map(strip),
      events:events.filter(function(e){return !e.batchId||bIds.indexOf(e.batchId)>=0}).map(strip),
      leaves:leaves.filter(function(l){return l.status==="approved"&&fac.indexOf(l.userId)>=0}).map(function(l){return{id:l.id,userId:l.userId,from:l.from,to:l.to,status:"approved",facultyName:nameOf(l.userId)}}),
      certificates:certs.filter(function(c){return c.studentId===u.id&&c.status==="issued"}).map(strip)});
  }

  /* ---------- Actions ---------- */
  var A={},P={};
  function def(name,perm,fn){A[name]=fn;P[name]=perm}
  var ALL=["admin","faculty","student"],STAFF=["admin","faculty"],ADMIN=["admin"];

  def("lead",{pub:1,write:1},function(q){
    db.insert("Leads",{Received:env.now(),Name:S(q.name,80),Email:S(q.email,120),WhatsApp:q.phone?"+91 "+S(q.phone,15):"",Program:S(q.program||q.course,120),Source:S(q.src,80),Message:S(q.message,1000),Page:S(q.page,300),Status:"new"});
    return{noBoot:1};
  });
  def("verify",{pub:1},function(q){
    var no=S(q.certNo,40).toUpperCase();if(!no)throw err("Enter a certificate number.");
    var c=db.all("Certificates").find(function(r){return String(r.certNo).toUpperCase()===no});
    if(!c)return{found:false};
    var u=byId("Users",c.studentId);
    return{found:true,cert:{certNo:c.certNo,name:u?u.name:"",courseId:c.courseId,issueDate:c.issueDate,grade:c.grade,status:c.status}};
  });
  def("login",{pub:1,write:1},function(q){
    var email=S(q.email,120).toLowerCase(),key="fail:"+email,fails=+(env.cacheGet(key)||0);
    if(fails>=5)throw err("Too many wrong attempts. Try again in 15 minutes.");
    var u=db.all("Users").find(function(r){return String(r.email).trim().toLowerCase()===email});
    if(!u||u.status!=="active"||hashPw(String(q.password||""),u.salt)!==u.passHash){env.cachePut(key,String(fails+1),900);throw err("Email or password is incorrect.")}
    var token=env.uuid().replace(/-/g,"")+env.uuid().replace(/-/g,"");
    db.insert("Sessions",{token:token,userId:u.id,expires:env.nowPlus(SESSION_DAYS),createdAt:env.now()});
    db.update("Users",u,{lastLogin:env.now()});
    pruneSessions();
    return{token:token,data:boot(u)};
  });
  def("logout",{roles:ALL,write:1},function(q){var s=db.all("Sessions").find(function(r){return r.token===q.token});if(s)db.remove("Sessions",s);return{noBoot:1}});
  def("bootstrap",{roles:ALL},function(){return{}});
  def("changePassword",{roles:ALL,write:1},function(q,u){
    if(hashPw(String(q.oldPassword||""),u.salt)!==u.passHash)throw err("Your current password is incorrect.");
    checkPw(q.newPassword);var salt=env.uuid();db.update("Users",u,{salt:salt,passHash:hashPw(String(q.newPassword),salt)});return{};
  });

  /* Accounts (admin) */
  function nextCode(){var y=env.today().slice(0,4),n=db.all("Users").filter(function(r){return String(r.studentCode).indexOf("ARV-"+y)===0}).length+1;return "ARV-"+y+"-"+String(n).padStart(4,"0")}
  function enrollStudent(studentId,batchId){
    var b=batchOf(batchId),ex=db.all("Enrollments").find(function(e){return e.studentId===studentId&&e.batchId===batchId});
    if(ex){if(ex.status==="removed")db.update("Enrollments",ex,{status:"active",updatedAt:env.now()});else throw err("This student is already in that batch.");return}
    db.insert("Enrollments",{id:nextId("Enrollments","E"),studentId:studentId,batchId:batchId,courseId:b.courseId,status:"active",progress:"0",remark:"",enrolledAt:env.now(),updatedAt:env.now()});
  }
  def("saveUser",{roles:ADMIN,write:1},function(q){
    var role=S(q.role),name=S(q.name,80),email=S(q.email,120).toLowerCase(),phone=S(q.phone,15).replace(/\D/g,"");
    if(["faculty","student"].indexOf(role)<0)throw err("Choose student or faculty.");
    if(name.length<2)throw err("Enter the full name.");
    if(!okEmail(email))throw err("Enter a valid email address.");
    if(phone&&!/^\d{10}$/.test(phone))throw err("Enter a 10-digit mobile number.");
    var clash=db.all("Users").find(function(r){return String(r.email).toLowerCase()===email&&r.id!==q.id});
    if(clash)throw err("Another account already uses this email.");
    if(q.id){
      var x=byId("Users",q.id);if(!x||x.role==="admin")throw err("Account not found.");
      var patch={name:name,email:email,phone:phone};
      if(q.password){checkPw(q.password);patch.salt=env.uuid();patch.passHash=hashPw(String(q.password),patch.salt)}
      db.update("Users",x,patch);return{};
    }
    checkPw(q.password);var salt=env.uuid(),id=nextId("Users","U");
    db.insert("Users",{id:id,role:role,name:name,email:email,phone:phone,salt:salt,passHash:hashPw(String(q.password),salt),status:"active",studentCode:role==="student"?nextCode():"",createdAt:env.now(),lastLogin:""});
    if(role==="student"&&q.batchId)enrollStudent(id,S(q.batchId));
    return{newId:id};
  });
  def("setUserStatus",{roles:ADMIN,write:1},function(q){
    var x=byId("Users",q.id);if(!x||x.role==="admin")throw err("Account not found.");
    var st=q.status==="active"?"active":"removed";db.update("Users",x,{status:st});if(st!=="active")dropSessions(x.id);return{};
  });

  /* Batches (admin) */
  def("saveBatch",{roles:ADMIN,write:1},function(q){
    var courseId=S(q.courseId,30);if(!courseId)throw err("Choose a program.");
    var facultyId=S(q.facultyId,20);
    if(facultyId){var f=byId("Users",facultyId);if(!f||f.role!=="faculty"||f.status!=="active")throw err("Choose an active faculty member.")}
    var days=S(q.days,60).split(",").map(function(d){return d.trim()}).filter(function(d){return DAYS.indexOf(d)>=0});
    if(!days.length)throw err("Choose the class days.");
    var st=S(q.startTime,5),et=S(q.endTime,5);if(!isTime(st)||!isTime(et)||et<=st)throw err("Enter a valid class start and end time.");
    var sd=needDate(S(q.startDate,10),"start date"),ed=S(q.endDate,10);if(ed&&(!isDate(ed)||ed<sd))throw err("The end date must be after the start date.");
    var rec={courseId:courseId,facultyId:facultyId,kind:S(q.kind,20)||"Weekday",days:days.join(","),startTime:st,endTime:et,startDate:sd,endDate:ed,mode:S(q.mode,60)||"Classroom & online",
      meetingLink:link(q.meetingLink,"meeting link"),meetingInfo:S(q.meetingInfo,300),status:["upcoming","active","completed"].indexOf(q.status)>=0?q.status:"active"};
    var mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+sd.slice(5,7)-1];
    rec.name=S(q.name,60)||(courseId.toUpperCase()+"-"+mon+sd.slice(2,4)+"-"+(rec.kind==="Weekend"?"WE":"WD"));
    if(q.id){var b=batchOf(q.id);db.update("Batches",b,rec);
      if(b.courseId!==courseId)db.all("Enrollments").filter(function(e){return e.batchId===b.id}).forEach(function(e){db.update("Enrollments",e,{courseId:courseId})});return{}}
    rec.id=nextId("Batches","B");rec.createdAt=env.now();db.insert("Batches",rec);return{newId:rec.id};
  });
  def("deleteBatch",{roles:ADMIN,write:1},function(q){
    var b=batchOf(q.id);
    if(db.all("Enrollments").some(function(e){return e.batchId===b.id&&e.status!=="removed"}))throw err("This batch still has students. Remove them first, or mark the batch completed.");
    db.remove("Batches",b);return{};
  });
  def("enroll",{roles:ADMIN,write:1},function(q){var s=byId("Users",q.studentId);if(!s||s.role!=="student")throw err("Student not found.");enrollStudent(s.id,S(q.batchId));return{}});
  def("saveEnrollment",{roles:ADMIN,write:1},function(q){
    var e=byId("Enrollments",q.id);if(!e)throw err("Enrollment not found.");
    var st=["active","completed","dropped","removed"].indexOf(q.status)>=0?q.status:e.status,p=Math.max(0,Math.min(100,parseInt(q.progress===undefined?e.progress:q.progress,10)||0));
    db.update("Enrollments",e,{status:st,progress:String(p),remark:q.remark===undefined?e.remark:S(q.remark,300),updatedAt:env.now()});return{};
  });

  /* Teaching (faculty for own batches, admin for all) */
  def("markAttendance",{roles:STAFF,write:1},function(q,u){
    var b=ownBatch(u,q.batchId),date=needDate(S(q.date,10));
    if(date>env.today())throw err("You can't mark attendance for a future date.");
    var roster=db.all("Enrollments").filter(function(e){return e.batchId===b.id&&e.status!=="removed"}).map(function(e){return e.studentId});
    var existing=db.all("Attendance").filter(function(a){return a.batchId===b.id&&a.date===date}),add=[],n=0;
    var nid=parseInt(nextId("Attendance","A").slice(1),10);
    (q.records||[]).forEach(function(r){
      var sid=S(r.studentId,20),st=["P","A","L"].indexOf(r.status)>=0?r.status:"";if(!st||roster.indexOf(sid)<0)return;
      var ex=existing.find(function(a){return a.studentId===sid});
      if(ex){if(ex.status!==st)db.update("Attendance",ex,{status:st,markedBy:u.id,markedAt:env.now()})}
      else add.push({id:"A"+String(nid++).padStart(4,"0"),batchId:b.id,date:date,studentId:sid,status:st,markedBy:u.id,markedAt:env.now()});
      n++;
    });
    if(!n)throw err("Mark at least one student.");
    db.insertMany("Attendance",add);return{saved:n};
  });
  def("saveTopic",{roles:STAFF,write:1},function(q,u){
    var b=ownBatch(u,q.batchId),topic=S(q.topic,300);if(topic.length<3)throw err("Describe the topic covered.");
    var rec={batchId:b.id,date:needDate(S(q.date,10)),module:S(q.module,4),topic:topic,notes:S(q.notes,600)};
    if(q.id){var t=byId("Topics",q.id);if(!t||(u.role==="faculty"&&t.facultyId!==u.id))throw err("Topic not found.");db.update("Topics",t,rec);return{}}
    rec.id=nextId("Topics","T");rec.facultyId=u.id;rec.createdAt=env.now();db.insert("Topics",rec);return{};
  });
  def("deleteTopic",{roles:STAFF,write:1},function(q,u){var t=byId("Topics",q.id);if(!t||(u.role==="faculty"&&t.facultyId!==u.id))throw err("Topic not found.");db.remove("Topics",t);return{}});
  def("setProgress",{roles:STAFF,write:1},function(q,u){
    var n=0;(q.items||[]).forEach(function(it){
      var e=byId("Enrollments",it.enrollmentId);if(!e)return;ownBatch(u,e.batchId);
      var p=Math.max(0,Math.min(100,parseInt(it.progress,10)||0)),patch={progress:String(p),remark:S(it.remark,300),updatedAt:env.now()};
      if(u.role==="admin"&&["active","completed","dropped"].indexOf(it.status)>=0)patch.status=it.status;
      db.update("Enrollments",e,patch);n++;
    });
    if(!n)throw err("Nothing to save.");return{saved:n};
  });
  def("saveEvent",{roles:STAFF,write:1},function(q,u){
    var type=["holiday","announcement","class-off","extra-class","exam"].indexOf(q.type)>=0?q.type:"announcement";
    var batchId=S(q.batchId,20);
    if(u.role==="faculty"){if(!batchId)throw err("Choose one of your batches.");ownBatch(u,batchId);if(type==="holiday")throw err("Only the admin can declare holidays.")}
    else if(batchId)batchOf(batchId);
    var title=S(q.title,120);if(title.length<3)throw err("Enter a title.");
    var d=needDate(S(q.date,10)),ed=S(q.endDate,10);if(ed&&(!isDate(ed)||ed<d))throw err("The end date must be on or after the start date.");
    var rec={type:type,title:title,date:d,endDate:ed,batchId:batchId,details:S(q.details,600)};
    if(q.id){var ev=byId("Events",q.id);if(!ev||(u.role==="faculty"&&ev.createdBy!==u.id))throw err("Notice not found.");db.update("Events",ev,rec);return{}}
    rec.id=nextId("Events","N");rec.createdBy=u.id;rec.createdAt=env.now();db.insert("Events",rec);return{};
  });
  def("deleteEvent",{roles:STAFF,write:1},function(q,u){var ev=byId("Events",q.id);if(!ev||(u.role==="faculty"&&ev.createdBy!==u.id))throw err("Notice not found.");db.remove("Events",ev);return{}});

  /* Leave (faculty applies, admin decides) */
  def("applyLeave",{roles:["faculty"],write:1},function(q,u){
    var f=needDate(S(q.from,10),"from date"),t=needDate(S(q.to,10)||f,"to date");if(t<f)throw err("The 'to' date must be on or after the 'from' date.");
    var reason=S(q.reason,300);if(reason.length<3)throw err("Enter a reason.");
    db.insert("Leaves",{id:nextId("Leaves","L"),userId:u.id,from:f,to:t,reason:reason,status:"pending",decidedBy:"",decidedAt:"",createdAt:env.now()});return{};
  });
  def("cancelLeave",{roles:["faculty"],write:1},function(q,u){var l=byId("Leaves",q.id);if(!l||l.userId!==u.id||l.status!=="pending")throw err("Only pending requests can be withdrawn.");db.remove("Leaves",l);return{}});
  def("decideLeave",{roles:ADMIN,write:1},function(q,u){var l=byId("Leaves",q.id);if(!l)throw err("Request not found.");db.update("Leaves",l,{status:q.status==="approved"?"approved":"rejected",decidedBy:u.id,decidedAt:env.now()});return{}});

  /* Class content (admin) */
  def("saveRecording",{roles:ADMIN,write:1},function(q,u){
    var b=batchOf(q.batchId),title=S(q.title,150);if(title.length<3)throw err("Enter a title.");
    var rec={batchId:b.id,title:title,date:needDate(S(q.date,10)),module:S(q.module,4),url:link(q.url,"video link",true)};
    if(q.id){var r=byId("Recordings",q.id);if(!r)throw err("Recording not found.");db.update("Recordings",r,rec);return{}}
    rec.id=nextId("Recordings","R");rec.addedBy=u.id;rec.createdAt=env.now();db.insert("Recordings",rec);return{};
  });
  def("deleteRecording",{roles:ADMIN,write:1},function(q){var r=byId("Recordings",q.id);if(!r)throw err("Recording not found.");db.remove("Recordings",r);return{}});
  def("saveNote",{roles:ADMIN,write:1},function(q,u){
    var b=batchOf(q.batchId),title=S(q.title,150);if(title.length<3)throw err("Enter a title.");
    var rec={batchId:b.id,title:title,url:link(q.url,"file link",true),kind:S(q.kind,30)||"Notes",date:S(q.date,10)||env.today()};
    if(q.id){var r=byId("Notes",q.id);if(!r)throw err("Note not found.");db.update("Notes",r,rec);return{}}
    rec.id=nextId("Notes","M");rec.addedBy=u.id;rec.createdAt=env.now();db.insert("Notes",rec);return{};
  });
  def("deleteNote",{roles:ADMIN,write:1},function(q){var r=byId("Notes",q.id);if(!r)throw err("Note not found.");db.remove("Notes",r);return{}});

  /* Certificates (admin issues; student downloads; anyone can verify) */
  def("issueCertificate",{roles:ADMIN,write:1},function(q,u){
    var e=byId("Enrollments",q.enrollmentId);if(!e)throw err("Choose a student enrolment.");
    var dup=db.all("Certificates").find(function(c){return c.studentId===e.studentId&&c.courseId===e.courseId&&c.status==="issued"});
    if(dup)throw err("This student already has a certificate for this program ("+dup.certNo+").");
    var d=needDate(S(q.issueDate,10)||env.today(),"issue date"),yy=d.slice(2,4);
    var code=String(e.courseId).toUpperCase().replace(/[^A-Z]/g,"").slice(0,4)||"ARV";
    var seq=db.all("Certificates").filter(function(c){return String(c.certNo).indexOf("ARV-"+yy+"-")===0}).length+1;
    var certNo="ARV-"+yy+"-"+code+"-"+String(seq).padStart(4,"0");
    db.insert("Certificates",{id:nextId("Certificates","C"),certNo:certNo,studentId:e.studentId,courseId:e.courseId,batchId:e.batchId,issueDate:d,grade:S(q.grade,30),status:"issued",issuedBy:u.id,createdAt:env.now()});
    db.update("Enrollments",e,{status:"completed",progress:"100",updatedAt:env.now()});
    return{certNo:certNo};
  });
  def("setCertificateStatus",{roles:ADMIN,write:1},function(q){var c=byId("Certificates",q.id);if(!c)throw err("Certificate not found.");db.update("Certificates",c,{status:q.status==="issued"?"issued":"revoked"});return{}});

  /* Leads (admin) */
  def("updateLead",{roles:ADMIN,write:1},function(q){var row=parseInt(q.id,10),l=db.all("Leads").find(function(r){return r._row===row});if(!l)throw err("Lead not found.");db.update("Leads",l,{Status:S(q.status,30)});return{}});

  function handle(q){
    q=q||{};
    try{
      var fn=A[q.action],perm=P[q.action];if(!fn)throw err("Unknown request.");
      var run=function(){
        var u=null;
        if(!perm.pub){u=sessionUser(q.token);if(perm.roles.indexOf(u.role)<0)throw err("Your account doesn't have access to this.")}
        var r=fn(q,u)||{};
        if(u&&!r.noBoot&&!r.data)r.data=boot(byId("Users",u.id));
        delete r.noBoot;return Object.assign({ok:true},r);
      };
      return perm.write?env.lock(run):run();
    }catch(e){return{ok:false,error:e&&e.user?e.message:"Something went wrong on the server. Please try again."+(e&&e.message?" ("+e.message+")":"")}}
  }
  /* First-time setup: creates every tab with headers, and the first admin account */
  function setup(admin){
    Object.keys(ARIVU_SCHEMA).forEach(function(t){db.all(t)});
    var admins=db.all("Users").filter(function(u){return u.role==="admin"&&u.status==="active"}).map(function(u){return u.email});
    if(admins.length)return "Sheets are ready. Admin account already exists: "+admins.join(", ")+". To use the email and password in SETUP_ADMIN instead, run resetAdmin.";
    var email=S(admin.email,120).toLowerCase();if(!okEmail(email))throw new Error("Set a valid ADMIN_EMAIL first.");checkPw(admin.password);
    var salt=env.uuid();
    db.insert("Users",{id:nextId("Users","U"),role:"admin",name:S(admin.name,80)||"Admin",email:email,phone:"",salt:salt,passHash:hashPw(String(admin.password),salt),status:"active",studentCode:"",createdAt:env.now(),lastLogin:""});
    return "Sheets are ready. Admin account created for "+email+". Log in on the website and change the password.";
  }
  /* Recovery: make SETUP_ADMIN an active admin with that password (creates it if missing) */
  function resetAdmin(admin){
    Object.keys(ARIVU_SCHEMA).forEach(function(t){db.all(t)});
    var email=S(admin.email,120).toLowerCase();if(!okEmail(email))throw new Error("Put a valid email in SETUP_ADMIN first.");checkPw(admin.password);
    var salt=env.uuid(),hash=hashPw(String(admin.password),salt);
    var u=db.all("Users").find(function(r){return String(r.email).trim().toLowerCase()===email});
    if(u)db.update("Users",u,{email:email,role:"admin",status:"active",salt:salt,passHash:hash,name:u.name||S(admin.name,80)||"Admin"});
    else db.insert("Users",{id:nextId("Users","U"),role:"admin",name:S(admin.name,80)||"Admin",email:email,phone:"",salt:salt,passHash:hash,status:"active",studentCode:"",createdAt:env.now(),lastLogin:""});
    env.cachePut("fail:"+email,"0",1);
    var admins=db.all("Users").filter(function(r){return r.role==="admin"&&r.status==="active"}).map(function(r){return r.email});
    return (u?"Password reset for ":"Admin account created for ")+email+". You can log in now. Active admin accounts: "+admins.join(", ");
  }
  return{handle:handle,setup:setup,resetAdmin:resetAdmin,_internal:{hashPw:hashPw,nextId:nextId,enrollStudent:enrollStudent}};
}
