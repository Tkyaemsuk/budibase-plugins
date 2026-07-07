# 🧩 Budibase Custom Plugins

<p align="center">

<img src="https://img.shields.io/badge/Budibase-v3.4.1-purple?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Svelte-3-orange?style=for-the-badge&logo=svelte"/>
<img src="https://img.shields.io/badge/Plugin-Development-blue?style=for-the-badge"/>

</p>


<h2 align="center">
Custom Extensions for Budibase Platform
</h2>

<p align="center">
Building reusable components and automation tools for Budibase applications.
</p>


---

# 🚀 About This Repository

This repository contains custom plugins developed for:

## :contentReference[oaicite:0]{index=0} v3.4.1

The goal is to extend Budibase capabilities by creating custom components,
data tools, and workflow utilities.

Built with:

- Svelte 3
- JavaScript
- Budibase Plugin API
- Rollup
- Node.js


---

# 📦 Available Plugins


## 📄 CSV Export Pro

Repository:

`plugins/csv-export-pro`


### Description

A powerful CSV export component for Budibase applications.

Designed for exporting database records into CSV format with customizable options.


### Features

✅ Export Table Data  
✅ Custom Column Selection  
✅ Column Builder  
✅ Custom Header Mapping  
✅ CSV Generator  
✅ Large Dataset Support  
✅ Business Report Export  


### Technology

```
Svelte 3
JavaScript
PapaParse
Budibase Component API
```


---

## 📑 PDF Converter

Repository:

`plugins/pdf-converter`


### Description

A document conversion utility plugin for generating PDF documents from Budibase applications.


### Features

✅ Convert Data to PDF  
✅ Generate Printable Documents  
✅ Custom Document Layout  
✅ Report Generation  
✅ Business Document Support  


### Technology

```
Svelte 3
JavaScript
PDF Generation Library
Budibase Plugin API
```


---

# 🏗 Plugin Architecture


```
budibase-custom-plugin

│
├── csv-export-pro/
├── src/
│   └── ExportCSV.svelte
├── plugin.js
├── plugin.json
├── package.json
├── rollup.config.js
└── README.md
│
│
└── pdf-converter
    │
    ├── src
    ├── PDFConverter.svelte
    ├── plugin.js
    └── plugin.json

```


---

# 🛠 Development


## Install Dependencies


```bash
npm install
```


## Development Mode


```bash
npm run dev
```


## Build Plugin


```bash
npm run build
```


Build output:

```
dist/
```


---

# 🔌 Installation


1. Build plugin

```bash
npm run build
```


2. Upload plugin package into:

```
Budibase Builder
→ Settings
→ Plugins
→ Upload Plugin
```


3. Enable component inside your application


---

# 🎯 Roadmap


## CSV Export Pro

- [x] Basic CSV Export
- [x] Column Selection
- [ ] Advanced Formatting
- [ ] Export Templates
- [ ] Scheduled Export


## PDF Converter

- [x] Basic PDF Generation
- [ ] Custom Templates
- [ ] Header / Footer Builder
- [ ] Multi-page Report


---

# 🤝 Philosophy


These plugins are created with the idea:

> Low-code platforms should be flexible enough for professional developers.


Custom plugins allow teams to extend Budibase beyond default components.


---

# 👨‍💻 Developer


**Thanakrit Yaemsuk**

Software Engineer  
Budibase Plugin Developer  
System Builder  


GitHub:

https://github.com/Tkyaemsuk


---

<p align="center">

Built with ❤️ using Svelte + Budibase

</p>
