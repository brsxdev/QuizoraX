const http = require("node:http")
const express = require("express")
const bcrypt = require("bcrypt")
const conexion = require("./sqlconexion")
const servidorexpress = express()
const servidorhttp = http.createServer(servidorexpress)
const session = require("express-session")
const MySQLStore = require("express-mysql-session")(session)
const path = require("node:path")
require("dotenv").config()
const storeSesion = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
})

servidorexpress.use(session({
    secret:process.env.SESSION_SECRET,
    store:storeSesion,
    rolling:true,
    resave:false,
    saveUninitialized:false,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24 * 30 * 6,
        httpOnly:true
    }
}))

function sihay(req,res,next){
    if (req.session.usuarioid && req.session.usuario){
        return res.redirect("/principal")
    } 
    next()
}

function nohay(req,res,next){
    if (!req.session.usuarioid && !req.session.usuario){
        return res.redirect("/")
    }
    next()
}
servidorexpress.use(express.json())
servidorexpress.use(express.static(path.resolve("WEB")))
servidorexpress.get("/",sihay, (req,res)=>{
    res.sendFile(path.resolve("WEB/inicio.html"))
})

servidorexpress.get("/registro",sihay,(req,res)=>{
    res.sendFile(path.resolve("WEB/registrar.html"))
})

servidorexpress.get("/iniciodesesion",sihay,(req,res)=>{
    res.sendFile(path.resolve("WEB/initsesion.html"))
})
servidorexpress.get("/comofunciona",(req,res)=>{
    res.sendFile(path.resolve("WEB/tutorial.html"))
})
servidorexpress.get("/principal",nohay,(req,res)=>{
    res.sendFile(path.resolve("WEB/PAGINA/principal.html"))
})
servidorexpress.get("/configuracion",nohay,(req,res)=>{
    res.sendFile(path.resolve("WEB/PAGINA/config.html"))
})
servidorexpress.get("/actualusuario",nohay,(req,res)=>{
    return res.json({usuario:req.session.usuario, usuarioid:req.session.usuarioid})
})
servidorexpress.get("/perfiles/:id",nohay,(req,res)=>{
    res.sendFile(path.resolve("WEB/PAGINA/perfil.html"))
})

servidorexpress.get("/admin",nohay,(req,res)=>{
    if (req.session.usuarioid !== 1){
        return res.json({Mensaje:"Acceso denegado"})
    }

    res.sendFile(path.resolve("WEB/PAGINA/panel.html"))
})

servidorexpress.get("/preguntas",nohay,(req,res)=>{
    res.sendFile(path.resolve("WEB/PAGINA/cuestionario.html"))
})

servidorexpress.get("")

servidorexpress.get("/api/perfiles/:id",nohay,(req,res)=>{
    console.log(req.params.id)
    conexion.query(`SELECT * FROM users
        WHERE id=?`,[req.params.id],(err,resultado)=>{
            if (err){return}
            let objeto = {usuario:resultado[0].usuario, id:resultado[0].id, descp:resultado[0].descripcion ?? "Sin descripcion"}
            conexion.query(`SELECT * FROM ranking
                WHERE usuario_id=?`,[req.params.id],(err2,result2)=>{
                    if (err2){
                        return
                    }
                    if (result2[0].puntos === null){
                        objeto.posicion = "El usuario no ha participado por el momento"
                        return res.json(objeto)
                    } else{
                        conexion.query(`SELECT puesto
                                FROM (
                                SELECT usuario_id,
                                RANK() OVER (ORDER BY puntos DESC) AS puesto
                                FROM ranking
                                ) AS tabla
                                WHERE usuario_id = ?`,[req.params.id],(err3,result3)=>{
                            if (err3){return}
                            objeto.posicion = {puesto: result3[0].puesto, puntos:result2[0].puntos}
                            res.json(objeto)
                        })
                    }
                })
        })
})
servidorexpress.get("/ranking",(req,res)=>{
    res.sendFile(path.resolve("WEB/PAGINA/ranking.html"))
})
servidorexpress.post("/registrarse",(req,res)=>{
    const {usuario,pwd} = req.body
    conexion.query(`SELECT * FROM users
        WHERE usuario=?`,[usuario],(err,result)=>{
            if (err){return}
            if (result.length > 0){
                return res.json({existe:true})
            }
            async function fp(){
                const pwdhash = await bcrypt.hash(pwd, 10)
                if (result.length === 0){
                conexion.query(`INSERT INTO users(usuario,pwd)
                    VALUES (?,?)`,[usuario,pwdhash],(err2,result2)=>{
                        if (err2){return}
                        req.session.usuario = usuario
                        req.session.usuarioid = result2.insertId
                        res.json({existe:false})
                    })
            }
            }
            fp()
        })
})

servidorexpress.post("/iniciarsesion", (req,res)=>{
    const {usuario,pwd} = req.body
    conexion.query(`SELECT * FROM users
        WHERE usuario=?`,[usuario],(err,result)=>{
            if (err){
                return
            }
            if (result.length === 0){
                return res.json({existe:false})
            }
            if (result.length > 0){
                async function comparar(){
                    const coincide = await bcrypt.compare(pwd, result[0].pwd)
                    if (coincide){ 
                        req.session.usuario = usuario
                        req.session.usuarioid = result[0].id
                        res.json({existe:true})
                    } else{
                        res.json({existe:false})
                    }
                }
                comparar()
            }
        })
})

servidorexpress.post("/ponerenranking",(req,res)=>{
    conexion.query(`SELECT * FROM ranking
        WHERE usuario_id=?`,[req.session.usuarioid],(err,result)=>{
            if (err){
                return
            }
            if (result.length > 0){
                return
            }
            if (result.length === 0){
                conexion.query(`INSERT INTO ranking(usuario_id)
                    VALUES (?)`,[req.session.usuarioid],(err,result2)=>{
                        if (err){return}
                        res.end()
                    })
            }
        })
})
servidorexpress.post("/obtenerpuestos",(req,res)=>{
    conexion.query(`SELECT 
    u.usuario,
    r.puntos,
    RANK() OVER (ORDER BY r.puntos DESC) AS puesto
FROM ranking r
INNER JOIN users u ON r.usuario_id = u.id
WHERE r.puntos IS NOT NULL
ORDER BY r.puntos DESC
LIMIT 20;`, (error,resultado)=>{
            if (error){return}
            console.log(resultado)
            res.json({lista:resultado})
    })
})
servidorexpress.post("/mandarconfig",async (req,res)=>{
    const {id} = req.body
    let objeto = {}
    if (req.body.descripcion){
        objeto.descripcion = req.body.descripcion
    } 
    if (req.body.pwd){
        const ahash = await bcrypt.hash(req.body.pwd, 10)
        objeto.pwd = ahash
    }

    const campos = Object.keys(objeto)
    if (campos.length === 0) {
    return res.json({respuesta:true})
    }
    const valores = Object.values(objeto)

    const set = campos.map(campo=>`${campo} = ?`).join(", ")
    valores.push(id)

    conexion.query(`UPDATE users
        SET ${set} WHERE id=?`,valores,(err,resultado)=>{
            if (err){return}
            res.json({respuesta:true})
        })
})
servidorexpress.post("/cerrarsesion",(req,res)=>{
    req.session.destroy((error)=>{
        if (error){return}
        res.clearCookie("connect.sid")
        res.json({cerrado:true})
    })
})
servidorexpress.post("/entregarpreguntas",(req,res)=>{
    const {categoria} = req.body
    conexion.query(`SELECT pregunta,oA,oB,oC,oD,oE,rpta FROM preguntas
WHERE categoria = ?
ORDER BY RAND()`,[categoria],(err,respt)=>{
    if (err){return}
    console.log(respt)
    res.json({lista:respt})
})
})
servidorexpress.post("/enviarpregunta",(req,res)=>{
    

    conexion.query(`INSERT INTO preguntas(pregunta,oA,oB,oC,oD,oE,rpta,categoria)
        VALUES (?,?,?,?,?,?,?,?)`,Object.values(req.body),(err,resultado)=>{
        if (err){return}
        res.end()
    })
})

servidorexpress.post("/cambiarpregunta",(req,res)=>{
    const {categoria,id,pregunta,oA,oB,oC,oD,oE,rpta} = req.body
    conexion.query(`SELECT 
id AS id_pregunta, 
pregunta, 
categoria
FROM preguntas
WHERE categoria = ?
ORDER BY id ASC`,[categoria],(err1,result1)=>{
    if (err1){return}
    console.log(result1)
    for (let elemento of result1){
        if (Number(elemento.id_pregunta) === Number(id)){
            conexion.query(`UPDATE preguntas
                SET pregunta=?,
                oA=?,
                oB=?,
                oC=?,
                oD=?,
                oE=?,
                rpta=?
                WHERE id=?`,[pregunta,oA,oB,oC,oD,oE,rpta,id],(err2,result2)=>{
                    if (err2){return}
                    res.end()
                })
        }
    }
})
})

servidorexpress.post("/sumarpuntos",(req,res)=>{
    const {puntosacumulados,usuarioid} = req.body
    console.log(req.body)
    conexion.query(`UPDATE ranking
        SET puntos = COALESCE(puntos, 0) + ?
        WHERE usuario_id=?`,[puntosacumulados,usuarioid],(err,result)=>{
            if (err){return}
            res.json({exito:true})
        })
})
const PORT = process.env.PORT || 3000;

servidorhttp.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});