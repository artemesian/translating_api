const express=require('express');
const bodyParser=require('body-parser');
const cors=require('cors');
const knex=require('knex');
const bcrypt = require('bcryptjs');
const app=express();
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const { IamAuthenticator } = require('ibm-watson/auth');

const languageTranslator = new LanguageTranslatorV3({
  version: '2018-05-01',
  authenticator: new IamAuthenticator({
    apikey: '',
  }),
  url: 'https://gateway-lon.watsonplatform.net/language-translator/api',
});

const db=knex({
    client:'pg',
    connection:{
        host:'127.0.0.1',
        user:'postgres',
        password:'Angelo2001',
        database:'translating-db'
    }
});
app.use(bodyParser.json());
app.use(cors());
app.get("/",(req,res)=>{
	res.json("it's working")
})
app.post("/signin",(req,res)=>{
	let { email,password } = req.body;
	db.select("hash").from('login').where('email','=',email).then(data=>{
		if(bcrypt.compareSync(password,data[0].hash)){
			db.select("*").from('users').where('email','=',email)
			.then(user=>res.status(200).json(user[0]))
		}else{
			res.status(400).json("wrong credentials")
		}
	})
	.catch(err=>res.status(400).json("failure"))
})

app.post("/register",(req,res)=>{
	let { name,email,password } = req.body;
	const hash =  bcrypt.hashSync(password);

	db.transaction(trx=>{
		trx.insert({
			hash: hash,
			email: email
		})
		.into('login')
		.returning('email')
		.then(loginEmail=>{
			return trx('users')
			.returning('*')
			.insert({
				email:loginEmail[0],
				name: name,
			})
			.then(user=>{
				res.status(200).json(user[0])
				console.log(user)
			}
			)
		})
		.then(trx.commit)
		.catch(trx.rollback)
 	})
	.catch(err=>{res.status(400).json("email exist"); console.log(err)})
})
app.post("/add",(req,res)=>{
	let { translateFromContent,translateToContent,email } = req.body;
		db.insert({
			email:email,
			translatefr:translateFromContent.toLowerCase(),
			translatede:translateToContent.toLowerCase(),
		})
		.into('translates')
		.returning("*")
		.then(translate=>{console.log(translate);res.status(200).json("success");})
		.catch(err=>res.status(400).json("unable to add"))
	
})

app.post('/search',(req,res)=>{
		let { translateFrom,translateTo,searchField,email} = req.body;
		const reqOutIn = (From,To) => {
			db.select(`translate${To}`).from("translates").where(`translate${From}`,'=',searchField)
				.then(translate=>{
					console.log(translate)
					if(!translate.length){
						languageTranslator.translate(
						  {
						    text:searchField,
						    source: From,
						    target: To
						  })
						  .then(response => {
						  		console.log(1,From,To,response)
						  		db.insert({
											email:email,
											[`translate${From}`]:searchField.toLowerCase(),
											[`translate${To}`]:response.result['translations'][0]['translation'].toLowerCase(),
										})
										.into('translates')
										.returning("*")
										.then(translate=>{console.log(translate)})
										.catch(err=>{console.log(err)})
						    res.status("200").json({translateFrom:searchField,translateTo:response.result['translations'][0]['translation']})
						  })
						  .catch(err => {
						    console.log('error: ', err)
						    res.status("400").json("unable to search")
						  });
					}else{
							console.log(2,From,To,translate)
					res.status("200").json({translateFrom:searchField,translateTo:translate[0][`translate${To}`]})
					}
				})
			.catch(err=>{
				languageTranslator.translate(
						  {
						    text:searchField,
						    source: From,
						    target: To
						  })
						  .then(response => {
						  		console.log(1,From,To,response)
						    res.status("200").json({translateFrom:searchField,translateTo:response.result['translations'][0]['translation']})
						  })
						  .catch(err => {
						    console.log('error: ', err)
						    res.status("400").json("unable to search")
						  });})
		}
	if(["fr","de"].includes(translateFrom) && ["fr","de"].includes(translateTo)){
		console.log('1',req.body)
		if(translateFrom ==="fr"){
				console.log('2',req.body)
			reqOutIn('fr','de');
		}else{
			reqOutIn('de','fr')
				console.log('3',req.body)
		}
	}
	else{
		reqOutIn(translateFrom,translateTo)
			console.log('4',req.body)
	}
})

app.get('/play',(req,res)=>{
	db.raw("select translatefr,translatede from translates order by random() limit 5")
	.then(response=>{
		res.status(200).json(response.rows)
	})
	.catch(err=>res.status(400).json('Unable to play'))
})


app.listen(process.env.PORT || 3001,()=>console.log(`App is running on ${process.env.PORT || 3001 }`))















// db.schema.createTable('users', function (table) {
//   table.increments();
//   table.string('name');
//   table.timestamps();
// })
