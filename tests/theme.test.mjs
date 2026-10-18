import test from 'node:test';
import assert from 'node:assert/strict';
import * as theme from '../src/theme.js';
test('black is default even on a light system; system preference follows system',()=>{
 assert.equal(theme.readTheme({getItem:()=>null}),'dark');
 assert.equal(theme.resolveTheme('dark',false),'dark');
 assert.equal(theme.resolveTheme('light',true),'light');
 assert.equal(theme.resolveTheme('system',true),'dark');
 assert.equal(theme.resolveTheme('system',false),'light');
});
test('invalid saved preference and unavailable storage fall back to black',()=>{
 assert.equal(theme.readTheme({getItem:()=>'<script>'}),'dark');
 assert.equal(theme.readTheme({getItem:()=>{throw new Error('blocked')}}),'dark');
 assert.equal(theme.readTheme({getItem:()=> 'light'}),'light');
});
