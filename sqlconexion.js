
const mysql2 = require("mysql2")
require("dotenv").config()
const conexion = mysql2.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
})

conexion.connect((err,res)=>{
    if (err){console.log(err)}else{console.log("Se conecto exitosamente!")}
})

module.exports = conexion