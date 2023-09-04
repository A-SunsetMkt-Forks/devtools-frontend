/**
 * JavaScript code that provides the puppeteer utilities. See the
 * [README](https://github.com/puppeteer/puppeteer/blob/main/src/injected/README.md)
 * for injection for more information.
 *
 * @internal
 */
export declare const source = "\"use strict\";var C=Object.defineProperty;var ne=Object.getOwnPropertyDescriptor;var oe=Object.getOwnPropertyNames;var se=Object.prototype.hasOwnProperty;var u=(t,e)=>{for(var n in e)C(t,n,{get:e[n],enumerable:!0})},ie=(t,e,n,r)=>{if(e&&typeof e==\"object\"||typeof e==\"function\")for(let o of oe(e))!se.call(t,o)&&o!==n&&C(t,o,{get:()=>e[o],enumerable:!(r=ne(e,o))||r.enumerable});return t};var le=t=>ie(C({},\"__esModule\",{value:!0}),t);var Oe={};u(Oe,{default:()=>Re});module.exports=le(Oe);var T=class extends Error{constructor(e){super(e),this.name=this.constructor.name,Error.captureStackTrace(this,this.constructor)}},S=class extends T{},I=class extends T{#e;#t=\"\";set code(e){this.#e=e}get code(){return this.#e}set originalMessage(e){this.#t=e}get originalMessage(){return this.#t}};var qe=Object.freeze({TimeoutError:S,ProtocolError:I});var f=class t{#e=!1;#t=!1;#n;#r=()=>{};#o=new Promise(e=>{this.#r=e});#s;constructor(e){this.#s=e&&e.timeout>0?setTimeout(()=>{this.reject(new S(e.message))},e.timeout):void 0}#i(e){clearTimeout(this.#s),this.#n=e,this.#r()}resolve(e){this.#t||this.#e||(this.#e=!0,this.#i(e))}reject(e){this.#t||this.#e||(this.#t=!0,this.#i(e))}resolved(){return this.#e}finished(){return this.#e||this.#t}value(){return this.#n}async valueOrThrow(){if(await this.#o,this.#t)throw this.#n;return this.#n}static create(e){return new t(e)}static async race(e){let n=new Set;try{let r=e.map(o=>o instanceof t?(o.#s&&n.add(o),o.valueOrThrow()):o);return await Promise.race(r)}finally{for(let r of n)r.reject(new Error(\"Timeout cleared\"))}}};var G=new Map,X=t=>{let e=G.get(t);return e||(e=new Function(`return ${t}`)(),G.set(t,e),e)};var R={};u(R,{ariaQuerySelector:()=>ae,ariaQuerySelectorAll:()=>k});var ae=(t,e)=>window.__ariaQuerySelector(t,e),k=async function*(t,e){yield*await window.__ariaQuerySelectorAll(t,e)};var q={};u(q,{customQuerySelectors:()=>M});var O=class{#e=new Map;register(e,n){if(!n.queryOne&&n.queryAll){let r=n.queryAll;n.queryOne=(o,i)=>{for(let s of r(o,i))return s;return null}}else if(n.queryOne&&!n.queryAll){let r=n.queryOne;n.queryAll=(o,i)=>{let s=r(o,i);return s?[s]:[]}}else if(!n.queryOne||!n.queryAll)throw new Error(\"At least one query method must be defined.\");this.#e.set(e,{querySelector:n.queryOne,querySelectorAll:n.queryAll})}unregister(e){this.#e.delete(e)}get(e){return this.#e.get(e)}clear(){this.#e.clear()}},M=new O;var D={};u(D,{pierceQuerySelector:()=>ce,pierceQuerySelectorAll:()=>ue});var ce=(t,e)=>{let n=null,r=o=>{let i=document.createTreeWalker(o,NodeFilter.SHOW_ELEMENT);do{let s=i.currentNode;s.shadowRoot&&r(s.shadowRoot),!(s instanceof ShadowRoot)&&s!==o&&!n&&s.matches(e)&&(n=s)}while(!n&&i.nextNode())};return t instanceof Document&&(t=t.documentElement),r(t),n},ue=(t,e)=>{let n=[],r=o=>{let i=document.createTreeWalker(o,NodeFilter.SHOW_ELEMENT);do{let s=i.currentNode;s.shadowRoot&&r(s.shadowRoot),!(s instanceof ShadowRoot)&&s!==o&&s.matches(e)&&n.push(s)}while(i.nextNode())};return t instanceof Document&&(t=t.documentElement),r(t),n};var m=(t,e)=>{if(!t)throw new Error(e)};var P=class{#e;#t;#n;#r;constructor(e,n){this.#e=e,this.#t=n}async start(){let e=this.#r=f.create(),n=await this.#e();if(n){e.resolve(n);return}this.#n=new MutationObserver(async()=>{let r=await this.#e();r&&(e.resolve(r),await this.stop())}),this.#n.observe(this.#t,{childList:!0,subtree:!0,attributes:!0})}async stop(){m(this.#r,\"Polling never started.\"),this.#r.finished()||this.#r.reject(new Error(\"Polling stopped\")),this.#n&&(this.#n.disconnect(),this.#n=void 0)}result(){return m(this.#r,\"Polling never started.\"),this.#r.valueOrThrow()}},E=class{#e;#t;constructor(e){this.#e=e}async start(){let e=this.#t=f.create(),n=await this.#e();if(n){e.resolve(n);return}let r=async()=>{if(e.finished())return;let o=await this.#e();if(!o){window.requestAnimationFrame(r);return}e.resolve(o),await this.stop()};window.requestAnimationFrame(r)}async stop(){m(this.#t,\"Polling never started.\"),this.#t.finished()||this.#t.reject(new Error(\"Polling stopped\"))}result(){return m(this.#t,\"Polling never started.\"),this.#t.valueOrThrow()}},x=class{#e;#t;#n;#r;constructor(e,n){this.#e=e,this.#t=n}async start(){let e=this.#r=f.create(),n=await this.#e();if(n){e.resolve(n);return}this.#n=setInterval(async()=>{let r=await this.#e();r&&(e.resolve(r),await this.stop())},this.#t)}async stop(){m(this.#r,\"Polling never started.\"),this.#r.finished()||this.#r.reject(new Error(\"Polling stopped\")),this.#n&&(clearInterval(this.#n),this.#n=void 0)}result(){return m(this.#r,\"Polling never started.\"),this.#r.valueOrThrow()}};var H={};u(H,{pQuerySelector:()=>Ie,pQuerySelectorAll:()=>re});var c=class{static async*map(e,n){for await(let r of e)yield await n(r)}static async*flatMap(e,n){for await(let r of e)yield*n(r)}static async collect(e){let n=[];for await(let r of e)n.push(r);return n}static async first(e){for await(let n of e)return n}};var p={attribute:/\\[\\s*(?:(?<namespace>\\*|[-\\w\\P{ASCII}]*)\\|)?(?<name>[-\\w\\P{ASCII}]+)\\s*(?:(?<operator>\\W?=)\\s*(?<value>.+?)\\s*(\\s(?<caseSensitive>[iIsS]))?\\s*)?\\]/gu,id:/#(?<name>[-\\w\\P{ASCII}]+)/gu,class:/\\.(?<name>[-\\w\\P{ASCII}]+)/gu,comma:/\\s*,\\s*/g,combinator:/\\s*[\\s>+~]\\s*/g,\"pseudo-element\":/::(?<name>[-\\w\\P{ASCII}]+)(?:\\((?<argument>\u00B6*)\\))?/gu,\"pseudo-class\":/:(?<name>[-\\w\\P{ASCII}]+)(?:\\((?<argument>\u00B6*)\\))?/gu,universal:/(?:(?<namespace>\\*|[-\\w\\P{ASCII}]*)\\|)?\\*/gu,type:/(?:(?<namespace>\\*|[-\\w\\P{ASCII}]*)\\|)?(?<name>[-\\w\\P{ASCII}]+)/gu},fe=new Set([\"combinator\",\"comma\"]);var de=t=>{switch(t){case\"pseudo-element\":case\"pseudo-class\":return new RegExp(p[t].source.replace(\"(?<argument>\\xB6*)\",\"(?<argument>.*)\"),\"gu\");default:return p[t]}};function me(t,e){let n=0,r=\"\";for(;e<t.length;e++){let o=t[e];switch(o){case\"(\":++n;break;case\")\":--n;break}if(r+=o,n===0)return r}return r}function he(t,e=p){if(!t)return[];let n=[t];for(let[o,i]of Object.entries(e))for(let s=0;s<n.length;s++){let l=n[s];if(typeof l!=\"string\")continue;i.lastIndex=0;let a=i.exec(l);if(!a)continue;let h=a.index-1,d=[],V=a[0],B=l.slice(0,h+1);B&&d.push(B),d.push({...a.groups,type:o,content:V});let z=l.slice(h+V.length+1);z&&d.push(z),n.splice(s,1,...d)}let r=0;for(let o of n)switch(typeof o){case\"string\":throw new Error(`Unexpected sequence ${o} found at index ${r}`);case\"object\":r+=o.content.length,o.pos=[r-o.content.length,r],fe.has(o.type)&&(o.content=o.content.trim()||\" \");break}return n}var pe=/(['\"])([^\\\\\\n]+?)\\1/g,ye=/\\\\./g;function K(t,e=p){if(t=t.trim(),t===\"\")return[];let n=[];t=t.replace(ye,(i,s)=>(n.push({value:i,offset:s}),\"\\uE000\".repeat(i.length))),t=t.replace(pe,(i,s,l,a)=>(n.push({value:i,offset:a}),`${s}${\"\\uE001\".repeat(l.length)}${s}`));{let i=0,s;for(;(s=t.indexOf(\"(\",i))>-1;){let l=me(t,s);n.push({value:l,offset:s}),t=`${t.substring(0,s)}(${\"\\xB6\".repeat(l.length-2)})${t.substring(s+l.length)}`,i=s+l.length}}let r=he(t,e),o=new Set;for(let i of n.reverse())for(let s of r){let{offset:l,value:a}=i;if(!(s.pos[0]<=l&&l+a.length<=s.pos[1]))continue;let{content:h}=s,d=l-s.pos[0];s.content=h.slice(0,d)+a+h.slice(d+a.length),s.content!==h&&o.add(s)}for(let i of o){let s=de(i.type);if(!s)throw new Error(`Unknown token type: ${i.type}`);s.lastIndex=0;let l=s.exec(i.content);if(!l)throw new Error(`Unable to parse content for ${i.type}: ${i.content}`);Object.assign(i,l.groups)}return r}function*N(t,e){switch(t.type){case\"list\":for(let n of t.list)yield*N(n,t);break;case\"complex\":yield*N(t.left,t),yield*N(t.right,t);break;case\"compound\":yield*t.list.map(n=>[n,t]);break;default:yield[t,e]}}function y(t){let e;return Array.isArray(t)?e=t:e=[...N(t)].map(([n])=>n),e.map(n=>n.content).join(\"\")}p.combinator=/\\s*(>>>>?|[\\s>+~])\\s*/g;var ge=/\\\\[\\s\\S]/g,we=t=>t.length<=1?t:((t[0]==='\"'||t[0]===\"'\")&&t.endsWith(t[0])&&(t=t.slice(1,-1)),t.replace(ge,e=>e[1]));function Y(t){let e=!0,n=K(t);if(n.length===0)return[[],e];let r=[],o=[r],i=[o],s=[];for(let l of n){switch(l.type){case\"combinator\":switch(l.content){case\">>>\":e=!1,s.length&&(r.push(y(s)),s.splice(0)),r=[],o.push(\">>>\"),o.push(r);continue;case\">>>>\":e=!1,s.length&&(r.push(y(s)),s.splice(0)),r=[],o.push(\">>>>\"),o.push(r);continue}break;case\"pseudo-element\":if(!l.name.startsWith(\"-p-\"))break;e=!1,s.length&&(r.push(y(s)),s.splice(0)),r.push({name:l.name.slice(3),value:we(l.argument??\"\")});continue;case\"comma\":s.length&&(r.push(y(s)),s.splice(0)),r=[],o=[r],i.push(o);continue}s.push(l)}return s.length&&r.push(y(s)),[i,e]}var Q={};u(Q,{textQuerySelectorAll:()=>b});var Se=new Set([\"checkbox\",\"image\",\"radio\"]),be=t=>t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement||t instanceof HTMLInputElement&&!Se.has(t.type),Te=new Set([\"SCRIPT\",\"STYLE\"]),w=t=>!Te.has(t.nodeName)&&!document.head?.contains(t),_=new WeakMap,Z=t=>{for(;t;)_.delete(t),t instanceof ShadowRoot?t=t.host:t=t.parentNode},J=new WeakSet,Pe=new MutationObserver(t=>{for(let e of t)Z(e.target)}),g=t=>{let e=_.get(t);if(e||(e={full:\"\",immediate:[]},!w(t)))return e;let n=\"\";if(be(t))e.full=t.value,e.immediate.push(t.value),t.addEventListener(\"input\",r=>{Z(r.target)},{once:!0,capture:!0});else{for(let r=t.firstChild;r;r=r.nextSibling){if(r.nodeType===Node.TEXT_NODE){e.full+=r.nodeValue??\"\",n+=r.nodeValue??\"\";continue}n&&e.immediate.push(n),n=\"\",r.nodeType===Node.ELEMENT_NODE&&(e.full+=g(r).full)}n&&e.immediate.push(n),t instanceof Element&&t.shadowRoot&&(e.full+=g(t.shadowRoot).full),J.has(t)||(Pe.observe(t,{childList:!0,characterData:!0}),J.add(t))}return _.set(t,e),e};var b=function*(t,e){let n=!1;for(let r of t.childNodes)if(r instanceof Element&&w(r)){let o;r.shadowRoot?o=b(r.shadowRoot,e):o=b(r,e);for(let i of o)yield i,n=!0}n||t instanceof Element&&w(t)&&g(t).full.includes(e)&&(yield t)};var $={};u($,{checkVisibility:()=>xe,pierce:()=>A,pierceAll:()=>L});var Ee=[\"hidden\",\"collapse\"],xe=(t,e)=>{if(!t)return e===!1;if(e===void 0)return t;let n=t.nodeType===Node.TEXT_NODE?t.parentElement:t,r=window.getComputedStyle(n),o=r&&!Ee.includes(r.visibility)&&!Ne(n);return e===o?t:!1};function Ne(t){let e=t.getBoundingClientRect();return e.width===0||e.height===0}var Ae=t=>\"shadowRoot\"in t&&t.shadowRoot instanceof ShadowRoot;function*A(t){Ae(t)?yield t.shadowRoot:yield t}function*L(t){t=A(t).next().value,yield t;let e=[document.createTreeWalker(t,NodeFilter.SHOW_ELEMENT)];for(let n of e){let r;for(;r=n.nextNode();)r.shadowRoot&&(yield r.shadowRoot,e.push(document.createTreeWalker(r.shadowRoot,NodeFilter.SHOW_ELEMENT)))}}var j={};u(j,{xpathQuerySelectorAll:()=>U});var U=function*(t,e){let r=(t.ownerDocument||document).evaluate(e,t,null,XPathResult.ORDERED_NODE_ITERATOR_TYPE),o;for(;o=r.iterateNext();)yield o};var ve=/[-\\w\\P{ASCII}*]/,ee=t=>\"querySelectorAll\"in t,v=class extends Error{constructor(e,n){super(`${e} is not a valid selector: ${n}`)}},F=class{#e;#t;#n=[];#r=void 0;elements;constructor(e,n,r){this.elements=[e],this.#e=n,this.#t=r,this.#o()}async run(){if(typeof this.#r==\"string\")switch(this.#r.trimStart()){case\":scope\":this.#o();break}for(;this.#r!==void 0;this.#o()){let e=this.#r,n=this.#e;typeof e==\"string\"?e[0]&&ve.test(e[0])?this.elements=c.flatMap(this.elements,async function*(r){ee(r)&&(yield*r.querySelectorAll(e))}):this.elements=c.flatMap(this.elements,async function*(r){if(!r.parentElement){if(!ee(r))return;yield*r.querySelectorAll(e);return}let o=0;for(let i of r.parentElement.children)if(++o,i===r)break;yield*r.parentElement.querySelectorAll(`:scope>:nth-child(${o})${e}`)}):this.elements=c.flatMap(this.elements,async function*(r){switch(e.name){case\"text\":yield*b(r,e.value);break;case\"xpath\":yield*U(r,e.value);break;case\"aria\":yield*k(r,e.value);break;default:let o=M.get(e.name);if(!o)throw new v(n,`Unknown selector type: ${e.name}`);yield*o.querySelectorAll(r,e.value)}})}}#o(){if(this.#n.length!==0){this.#r=this.#n.shift();return}if(this.#t.length===0){this.#r=void 0;return}let e=this.#t.shift();switch(e){case\">>>>\":{this.elements=c.flatMap(this.elements,A),this.#o();break}case\">>>\":{this.elements=c.flatMap(this.elements,L),this.#o();break}default:this.#n=e,this.#o();break}}},W=class{#e=new WeakMap;calculate(e,n=[]){if(e===null)return n;e instanceof ShadowRoot&&(e=e.host);let r=this.#e.get(e);if(r)return[...r,...n];let o=0;for(let s=e.previousSibling;s;s=s.previousSibling)++o;let i=this.calculate(e.parentNode,[o]);return this.#e.set(e,i),[...i,...n]}},te=(t,e)=>{if(t.length+e.length===0)return 0;let[n=-1,...r]=t,[o=-1,...i]=e;return n===o?te(r,i):n<o?-1:1},Ce=async function*(t){let e=new Set;for await(let r of t)e.add(r);let n=new W;yield*[...e.values()].map(r=>[r,n.calculate(r)]).sort(([,r],[,o])=>te(r,o)).map(([r])=>r)},re=function(t,e){let n,r;try{[n,r]=Y(e)}catch{return t.querySelectorAll(e)}if(r)return t.querySelectorAll(e);if(n.some(o=>{let i=0;return o.some(s=>(typeof s==\"string\"?++i:i=0,i>1))}))throw new v(e,\"Multiple deep combinators found in sequence.\");return Ce(c.flatMap(n,o=>{let i=new F(t,e,o);return i.run(),i.elements}))},Ie=async function(t,e){for await(let n of re(t,e))return n;return null};var ke=Object.freeze({...R,...q,...D,...H,...Q,...$,...j,Deferred:f,createFunction:X,createTextContent:g,IntervalPoller:x,isSuitableNodeForTextMatching:w,MutationPoller:P,RAFPoller:E}),Re=ke;\n";
//# sourceMappingURL=injected.d.ts.map