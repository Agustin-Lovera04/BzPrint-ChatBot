import express from 'express';
import { router as whatsappRouter } from './src/router/whatsapp-router.js';
import { config } from './src/config/config.js';
const PORT = config.PORT

const app=express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use('/webhook', whatsappRouter)

const server=app.listen(PORT,()=>{
    console.log(`Server escuchando en puerto ${PORT}`);
});
