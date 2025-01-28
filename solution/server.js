
import bcrypt from "bcryptjs";
import bodyParser from "body-parser";
import pg from "pg";
import express from "express";
import jwt from "jsonwebtoken"

function isCorrectURL(url){
  if (url === undefined){
    return true;
  }
  if (url === ''){
    return true;
  }
  else{
  try{
    const new_url = new URL(url);
    return true;
  } catch(e){
    return false;
  }}
}

const app = express();

const { Client } = pg;

const connectionString = process.env.POSTGRES_CONN || 'postgresql://postgres:p@0.0.0.0:5432/predprofdb';
const key = process.env.RANDOM_SECRET || 'PpLOCGxBJLYMz2WbmUpwFS8NQppMm7iK91rpTSXboYhbfOuHyULbxLBBmw2fDddtaUkie7g4RHSSakEsZFFx7XjHUUkbCGgjBOYTbtK0hLBUdHuppNAHDhVs6Cgc0mwJ';
const db = new Client({
  connectionString,
});
await db.connect();

try{
  await db.query('CREATE TABLE teachers( id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(128) UNIQUE NOT NULL, password VARCHAR(128) NOT NULL, subject VARCHAR(128) NOT NULL, avatar_url VARCHAR(255), token TEXT);');
}catch(e){}

try{
  await db.query('CREATE TABLE students( id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(128) UNIQUE NOT NULL, password VARCHAR(128) NOT NULL, exam_type VARCHAR(255) NOT NULL, maths BOOLEAN NOT NULL, informatics BOOLEAN NOT NULL, ruslang BOOLEAN NOT NULL, physics BOOLEAN NOT NULL, avatar_url VARCHAR(255), token TEXT);');

}catch(e){}
try{
  await db.query('CREATE TABLE income_users(email VARCHAR(128) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL);');

}catch(e){}


app.use(bodyParser.json());
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}\n${JSON.stringify(req.body, null, 2)}`);
  next();
});


app.use("/api/ping", (req, res, next) => {
 if (req.method === "GET") {
   res.end(JSON.stringify({ status: 200}));
 } else {
   next();
 }
});


app.use("/api/auth/sign-up", async (req, res, next) => {
  if (req.method === "POST") {
    
    const request = req.body;
    const email = request["email"];
    const password = request["password"];
    const password_repeat = request["password_repeat"];
    
    
    if ((!email || !password || (password !== password_repeat) || (password.length < 8)) || !(/\d/.test(password)) || !(/[!@#$%^&*_]/.test(password)) || (/[ '"]/.test(email)) || (!(email.includes('@'))) || (!(email.includes('.')))){
      res.status(400);
      
      res.end(JSON.stringify({ status: 400}));
      console.log("something bas happens here");
    }else{
      try{
          console.log(email);
          const check_student = await db.query('SELECT * FROM students WHERE email=$1', [email]);
          const check_teacher = await db.query('SELECT * FROM teachers WHERE email=$1', [email]);
          if (check_student.rows.length !== 0 || check_teacher.rows.length !== 0){ 

            res.status(409);
            res.end(JSON.stringify({ status: 409 }));
            
          } else{
            const hashed_pass = await bcrypt.hash(password, 10);
            await db.query('INSERT INTO income_users (email, password) VALUES ($1, $2)', [email, hashed_pass]);
                        
              res.status(200);
              res.end(JSON.stringify({ status: 200 }));


          }}
          catch(e){
            res.status(400);
            res.end(JSON.stringify({ status: 400 }));
            console.log(e);


          }}
      }

  
   else {
    next();
  }
 });

app.use("/api/auth/selection", async (req, res) => {
  if (req.method === 'POST'){
    const request = req.body;
    const name = request["name"];
    const subjects = request["subjects"];
    const role = request["role"];
    const avatar_url = request["avatar_url"] || '';
    if (!subjects || !role || !name){
      res.status(400);
      res.end(JSON.stringify({ status: 400 }));
    } else{
          
        try{
          const q = await db.query('SELECT * FROM income_users;');
          const email = q.rows[0]["email"];
          const hashed_password = q.rows[0]["password"];
           if (role === 'student'){
            let maths_flag = false;
            let ruslang_flag = false;
            let informatics_flag = false;
            let physics_flag = false; 
            console.log("we are here");
            console.log(subjects);

            if (subjects.includes("maths")) { maths_flag = true; }
            if (subjects.includes("ruslang")){ruslang_flag = true;}
            if (subjects.includes("informatics")){informatics_flag = true;}
            if (subjects.includes("physics")){physics_flag = true;}
            const exam_type = request["exam_type"];
            console.log(maths_flag, ruslang_flag, informatics_flag, physics_flag);
            try{

              const jwtoken = jwt.sign({email}, key, {expiresIn: '24h'});
              await db.query('INSERT INTO students (name, email, password, exam_type, maths, informatics, ruslang, physics, avatar_url, token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [name, email, hashed_password, exam_type, maths_flag, informatics_flag, ruslang_flag, physics_flag, avatar_url, "'"+jwtoken+"'"]);
              await db.query('TRUNCATE income_users');
              res.status(200);
              res.end(JSON.stringify({ status: 200}));

            } catch(e){

              res.status(400);
              res.end(JSON.stringify({ status: 400}));
              console.log(e);
              console.log("111");

            }} else if (role === 'teacher'){

              const subject = request["subjects"];
              
              const jwtoken = jwt.sign({email}, key, {expiresIn: '24h'});
              await db.query('INSERT INTO teachers (name, email, password, subject, avatar_url, token) VALUES ($1, $2, $3, $4, $5, $6)', [name, email, hashed_password, subject, avatar_url, "'"+jwtoken+"'"]);
              await db.query('TRUNCATE income_users');
              res.status(200);
              res.end(JSON.stringify({ status: 200}));
            } else{
              res.status(400);
              res.end(JSON.stringify({ status: 400 }));
            }
          
        } catch(e){
          console.log(e);
          res.status(400);
          res.end(JSON.stringify({ status: 400 }));
        }
         
          }
    }
    
  }
);

 app.use("/api/auth/sign-in", async (req, res, next) => {
  if (req.method === "POST") {
    
    const { email, password } = req.body;
    
    if (!email || !password || (password.length < 8) || !(/\d/.test(password)) || !(/[!@#$%^&*_]/.test(password)) || (/[ '"]/.test(email)) || !(/[a-zA-Z@.]/.test(email))){
      res.status(400);
      res.end(JSON.stringify({status: 400}));
      
    } else{
        try{
          const student = await db.query("SELECT * FROM students WHERE email=$1", [email]);
          const teacher = await db.query("SELECT * FROM teachers WHERE email=$1", [email]);

          if (student.rows.length !== 0){
            const pass = await db.query("SELECT password FROM students WHERE email=$1", [email]);
            const hpass = pass.rows[0]["password"];
            const check_pass = await bcrypt.compare(password, hpass);
            
            if (check_pass){
              const sub = email;
              const jwtoken = jwt.sign({sub}, key, {expiresIn: '24h'});
              try{
                await db.query('UPDATE students SET token=$1 WHERE email=$2', ["'"+jwtoken+"'", email]);
                res.status(200);
              res.end(JSON.stringify({ status: 200 }));
              } catch(e) {
                res.status(400);
                res.end(JSON.stringify({ status: 400 }));
                console.log(e);}
              
            } else{
              res.status(401);
              res.end(JSON.stringify({ status: 401 }));
              
            }
          } else if (teacher.rows.length !== 0){
            const pass = await db.query("SELECT password FROM teachers WHERE email=$1", [email]);
            const hpass = pass.rows[0]["password"];
            const check_pass = await bcrypt.compare(password, hpass);
            
            if (check_pass){
              const sub = email;
              const jwtoken = jwt.sign({sub}, key, {expiresIn: '24h'});
              try{
                await db.query('UPDATE teachers SET token=$1 WHERE email=$2', ["'"+jwtoken+"'", email]);
                res.status(200);
              res.end(JSON.stringify({ status: 200 }));
              } catch(e) {
                res.status(400);
                res.end(JSON.stringify({ status: 400 }));
                console.log(e);}
              
            } else{
              res.status(401);
              res.end(JSON.stringify({ status: 401 }));
              
            }
            
          } else{
            res.status(401);
              res.end(JSON.stringify({ status: 401 }));
          }
        } catch(e){
          res.status(400);
          res.end(JSON.stringify({ status: 400 }));
          
        }
    }
    
    
  } else {
    next();
  }
 });


 app.use('/api/user/profile', async (req, res, next) => {
  if (req.method === 'GET'){
    const token = req.headers.authorization.split(' ')[1];
    
    try{
      console.log(token);
      const check_student = await db.query('SELECT * FROM students WHERE token=$1', ["'"+token+"'"]);
      const check_teacher = await db.query('SELECT * FROM teachers WHERE token=$1', ["'"+token+"'"]);
      console.log(check_student, check_teacher);

      let name = '';
      let check = false;
      if (check_student.rows.length !== 0){
        name = check_student.rows[0]["name"];
        
      } else if (check_teacher.rows.length !== 0){
        
        name = check_teacher.rows[0]["name"];
      }       
      
      console.log(name);
      
      if (!name){
        res.status(400);
        res.end(JSON.stringify( {status: 400 }));
        console.log("sth bad happens in check");
        
      } else {
        const payload = {"name": name};
        res.send(payload);
        res.status(200);
    }
    } catch(e){
      res.status(400);
      res.end(JSON.stringify( {status: 400 }));
      console.log(e);
    }
 }
 else{
  next();
 }}
);



const serverAddress = process.env.SERVER_ADDRESS || '0.0.0.0:8080'
const [host, port] = serverAddress.split(':')
const http = app.listen(port, host, () => {
  console.log(`Listening on http://${serverAddress}`);
});
