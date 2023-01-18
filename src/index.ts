import * as functions from "firebase-functions";
import * as request from "request";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();
// On sign up.
exports.onLogin = functions.region("europe-west3").firestore
    .document("/login/{pushId}").onCreate((snap) => {
      // Grab the current value of what was written to Firestore.

      const options = {
        "method": "POST",
        "url": "https://login.salesforce.com/services/oauth2/token",
        "headers": {
          "Cookie": "BrowserId=TaoYxggOEeymUkmPo0OYrQ; CookieConsentPolicy=0:0",
        },
        "formData": {
          "grant_type": "password",
          "client_id": "3MVG9qQjGkWUbcrGVi307PrZ2XOLHJhLUnW5C"+
          "LPJON4I0uGfSOMcjtEPWj4PCjI3J89b9jJ7PCZD.eexdZbPA",
          "client_secret": "65036F5EEC52C0D41749E055E37B8B3FD"+
          "0817C80227CE8BA0F88A71EEA8B6AA4",
          "username": "juli.creus@escac.es",
          "password": "juliCre1ses",
        },
      };
      request(options, function(error, response) {
        if (error) throw new Error(error);
        console.log(JSON.parse(response.body).access_token);
        const options = {
          "method": "GET",
          "url": "https://escac4.my.salesforce.com/services/"+
          "data/v51.0/query?q=SELECT Id, Name,"+
          " MobilePhone, Prefijo__c, Email,"+
          " hed__UniversityEmail__c FROM Contact"+
          " WHERE Email='"+snap.data().email+"' + OR "+
          "hed__UniversityEmail__c='"+snap.data().email+"'",
          "headers": {
            "Authorization": "Bearer "+JSON.parse(response.body).access_token,
            "Content-Type": "application/json",
            "Cookie": "CookieConsentPolicy=0:1; "+
            "BrowserId=TaoYxggOEeymUkmPo0OYrQ",
          },
        };
        request(options, function(error, response) {
          if (error) throw new Error(error);
          const contacts = JSON.parse(response.body).records;
          console.log(contacts, response.body);
          const phone = new Map<string, number>();
          for (let x = 0; x<contacts.length; x++) {
            if (contacts[x].MobilePhone!=null) {
              phone.set(contacts[x].MobilePhone, contacts[x].Prefijo__c);
            }
          }
          console.log(phone, snap.data().email);
          try {
            const [firstKey] = phone.keys();
            const [firstValue] = phone.values();
            console.log(firstKey, firstValue);
            const time = Math.floor(Date.now());
            console.log(time, snap);
            let hash = ((9*time+13)%8192).toString();
            hash = "0000"+hash;
            hash= hash.slice(-4);
            const smsRef = db.collection("sms_verification");
            smsRef.doc(time.toString()).set({
              to: "+"+firstValue.toString()+firstKey.toString(),
              body: "Your security number is: "+hash,
            });
            // encryption
            const {publicKey, privateKey} = crypto.generateKeyPairSync("rsa", {
              // The standard secure default length for RSA keys is 2048 bits
              modulusLength: 2048,
            });
            const data = time+"_"+snap.data().tel+"_escac";
            const encryptedData = crypto.publicEncrypt({
              key: publicKey,
              padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
              oaepHash: "sha512",
            },
            // We convert the data string to a buffer using `Buffer.from`
            Buffer.from(data)
            );
            const dbset = db.collection("temp_code");
            dbset.doc(time.toString()).set({
              email: snap.data().email,
              time: time,
              tel: firstKey,
              hash: hash,
              cookie: encryptedData.toString("base64"),
              publicKey: publicKey.export({
                type: "pkcs1",
                format: "pem",
              }).toString("base64"),
            });
            const dbkey = db.collection("cookie_validation");
            dbkey.doc(time.toString()).set({
              email: snap.data().email,
              time: time,
              tel: firstKey,
              hash: hash,
              cookie: encryptedData.toString("base64"),
              privateKey: privateKey.export({
                type: "pkcs1",
                format: "pem",
              }).toString("base64"),
            });
          } catch (e) {
            console.log(e);
          }
        });
      });
    });

exports.getProgramEnrollments = functions.region("europe-west3").firestore
    .document("getProgramEnrollments/{docId}").onCreate((snap) => {
      const options = {
        "method": "POST",
        "url": "https://login.salesforce.com/services/oauth2/token",
        "headers": {
          "Cookie": "BrowserId=TaoYxggOEeymUkmPo0OYrQ; CookieConsentPolicy=0:0",
        },
        "formData": {
          "grant_type": "password",
          "client_id": "3MVG9qQjGkWUbcrGVi307PrZ2XOLHJhLUnW5C"+
          "LPJON4I0uGfSOMcjtEPWj4PCjI3J89b9jJ7PCZD.eexdZbPA",
          "client_secret": "65036F5EEC52C0D41749E055E37B8B3FD"+
          "0817C80227CE8BA0F88A71EEA8B6AA4",
          "username": "juli.creus@escac.es",
          "password": "juliCre1ses",
        },
      };
      request(options, function(error, response) {
        if (error) throw new Error(error);
        console.log(JSON.parse(response.body).access_token);

        const options = {
          "method": "GET",
          "url": "https://escac4.my.salesforce.com/services/data/v54.0/query/"+
          "?q=SELECT+Id+,+Name+,+hed__Account__c+,+"+
          "Account_Name__c+FROM+"+
          "hed__Program_Enrollment__c+"+
          "WHERE+hed__Contact__c+IN+(SELECT+Id+FROM+Contact"+
          "+WHERE+hed__UniversityEmail__c+=+'"+snap.data().email+"')",
          "headers": {
            "Authorization": "Bearer "+JSON.parse(response.body).access_token,
            "Content-Type": "application/json",
            "Cookie": "CookieConsentPolicy=0:1; "+
            "BrowserId=TaoYxggOEeymUkmPo0OYrQ",
          },
        };
        request(options, function(error, res) {
          const time = Math.floor(Date.now());
          const dbset = db.collection("program_enrollment");
          const records = JSON.parse(res.body).records;
          console.log(JSON.parse(res.body).totalSize);
          if (JSON.parse(res.body).totalSize!="0") {
            const programs = [];
            for (let i=0; i<records.length; i++) {
              const program = {"programID":
              records[i].Name,
              "RelatedAccount": records[i].hed__Account__c,
              "CourseName": records[i].Account_Name__c};
              programs.push(program);
            }
            console.log(programs);
            dbset.doc(snap.data().email).set({
              request_time: time,
              email: snap.data().email,
              programs: programs,
            });
          }
        });
      });
    });

exports.scheduledFunction = functions.region("europe-west3").pubsub
    .schedule("every 5 minutes").onRun(async () => {
      const fiveMin = Math.floor(Date.now())-5*6*1000;
      await db.collection("temp_code").where("time", "<=", fiveMin)
          .get().then(function(querySnapshot) {
            querySnapshot.forEach(async function(doc) {
              await doc.ref.delete();
            });
          });
      const month = Math.floor(Date.now())-60*60*24*30*1000;
      await db.collection("cookie_validation").where("time", "<=", month)
          .get().then(function(querySnapshot) {
            querySnapshot.forEach(async function(doc) {
              await doc.ref.delete();
            });
          });
    });

exports.getGradeBook = functions.region("europe-west3").firestore
    .document("getProgramEnrollments/{docId}").onCreate((snap) => {
      const options = {
        "method": "POST",
        "url": "https://login.salesforce.com/services/oauth2/token",
        "headers": {
          "Cookie": "BrowserId=TaoYxggOEeymUkmPo0OYrQ; CookieConsentPolicy=0:0",
        },
        "formData": {
          "grant_type": "password",
          "client_id": "3MVG9qQjGkWUbcrGVi307PrZ2XOLHJhLUnW5C"+
          "LPJON4I0uGfSOMcjtEPWj4PCjI3J89b9jJ7PCZD.eexdZbPA",
          "client_secret": "65036F5EEC52C0D41749E055E37B8B3FD"+
          "0817C80227CE8BA0F88A71EEA8B6AA4",
          "username": "juli.creus@escac.es",
          "password": "juliCre1ses",
        },
      };
      request(options, function(error, response) {
        if (error) throw new Error(error);
        console.log(JSON.parse(response.body).access_token);

        const options = {
          "method": "GET",
          "url": "https://escac4.my.salesforce.com/services/data/v54.0/query/"+
          "?q=SELECT+Name+,+rio_ed__Grade_Value__c+,"+
          "+rio_ed__Course_ID__c+,+hed__Program_Enrollment__c+,"+
          "+rio_ed__Credits_Offered__c+,"+
          "+rio_ed__Course__c+,+hed__grade__c+,+rio_ed__Term__c+,"+
          "+rio_ed__Attempt_Number__c+,+Tipo_Asignatura__c+,"+
          "+rio_ed__Plan_Requirement_Course__r.caracter__c"+
          "+FROM+hed__Course_Enrollment__c+"+
          "WHERE+hed__Contact__c+IN+(SELECT+Id+FROM+Contact"+
          "+WHERE+hed__UniversityEmail__c+=+'"+snap.data().email+"')",
          "headers": {
            "Authorization": "Bearer "+JSON.parse(response.body).access_token,
            "Content-Type": "application/json",
            "Cookie": "CookieConsentPolicy=0:1; "+
            "BrowserId=TaoYxggOEeymUkmPo0OYrQ",
          },
        };
        request(options, function(error, res) {
          const time = Math.floor(Date.now());
          const dbset = db.collection("grade_book");
          const records = JSON.parse(res.body).records;
          console.log(JSON.parse(res.body).totalSize);

          if (JSON.parse(res.body).totalSize!="0") {
            const courses = [];
            for (let i=0; i<records.length; i++) {
              const program = {"programID":
              records[i].Name,
              "RelatedAccount": records[i].hed__Account__c,
              "CourseName": records[i].Account_Name__c};
              courses.push(program);
            }
            console.log(courses);
            dbset.doc(snap.data().email).set({
              request_time: time,
              email: snap.data().email,
              courses: courses,
            });
          }
        });
      });
    });
