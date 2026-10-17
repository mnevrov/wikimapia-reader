import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',workers:1,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:390,height:844}},webServer:{command:'python3 -m http.server 5173 --bind 127.0.0.1 --directory dist',url:'http://127.0.0.1:5173',reuseExistingServer:true}});
