require('dotenv').config();
process.env.X_ZOHO_CATALYST_LISTEN_PORT = process.env.PORT || '3000';
require('./functions/AutoMateBRDFunction/index.js');
