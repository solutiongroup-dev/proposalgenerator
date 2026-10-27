import React, { useState, useRef } from "react";

const SG_BLUE = "#2B579A";
const SG_LIGHT = "#D5E8F0";
const SG_TEAL = "#4FA8A0";
const SG_DARK_GRAY = "#333333";
const SG_LIGHT_GRAY = "#F2F2F2";
const SG_BORDER_GRAY = "#CCCCCC";
import SG_LOGO from "./sg_logo.png";


const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #F2F5FA; color: #333333; }

  .header {
    background: #1a3a6b;
    padding: 0 40px;
    display: flex; align-items: center; gap: 20px;
    height: 68px;
    border-bottom: 4px solid ${SG_TEAL};
    box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  }
  .header-logo-wrap {
    background: white;
    border-radius: 6px;
    padding: 5px 10px;
    display: flex; align-items: center; justify-content: center;
    height: 48px;
    flex-shrink: 0;
  }
  .header-logo-img { height: 36px; width: auto; display: block; }
  .header-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.25); flex-shrink: 0; }
  .header-text { display: flex; flex-direction: column; gap: 2px; }
  .header-title { font-size: 15px; font-weight: 600; color: white; letter-spacing: 0.2px; }
  .header-sub { font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 400; letter-spacing: 1.4px; text-transform: uppercase; }
  .header-right { margin-left: auto; font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.5px; display:flex; align-items:center; gap:14px; }
  .help-btn { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:20px; color:white; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; padding:5px 12px; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.15s; }
  .help-btn:hover { background:rgba(255,255,255,0.22); }

  /* HELP MODAL */
  .help-overlay { position:fixed; inset:0; background:rgba(18,26,42,0.65); display:flex; align-items:center; justify-content:center; z-index:300; backdrop-filter:blur(4px); padding:20px; }
  .help-modal { background:white; border-radius:16px; max-width:620px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 24px 80px rgba(0,0,0,0.2); }
  .help-header { background:${SG_BLUE}; border-radius:14px 14px 0 0; padding:24px 28px; display:flex; align-items:center; justify-content:space-between; }
  .help-header h2 { color:white; font-size:20px; font-weight:600; }
  .help-header button { background:rgba(255,255,255,0.15); border:none; color:white; border-radius:50%; width:32px; height:32px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
  .help-header button:hover { background:rgba(255,255,255,0.25); }
  .help-body { padding:28px; }
  .help-steps { display:flex; flex-direction:column; gap:0; }
  .help-step { display:flex; gap:18px; position:relative; }
  .help-step:not(:last-child)::after { content:''; position:absolute; left:19px; top:44px; bottom:-8px; width:2px; background:#e2e8f0; }
  .help-step-num { width:40px; height:40px; border-radius:50%; background:${SG_BLUE}; color:white; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
  .help-step-content { flex:1; padding-bottom:28px; }
  .help-step-content h3 { font-size:15px; font-weight:600; color:#1a2332; margin-bottom:5px; }
  .help-step-content p { font-size:13px; color:#7a8a9a; line-height:1.6; font-weight:300; }
  .help-step-content .tip { font-size:12px; color:${SG_TEAL}; background:#e8f8f5; border-radius:4px; padding:6px 10px; margin-top:8px; font-weight:500; }
  .help-divider { border:none; border-top:1px solid #edf0f5; margin:20px 0; }
  .help-types { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; }
  .help-type { background:#f8f9fc; border-radius:8px; padding:12px 14px; }
  .help-type h4 { font-size:13px; font-weight:600; color:${SG_BLUE}; margin-bottom:3px; }
  .help-type p { font-size:12px; color:#7a8a9a; line-height:1.4; }

  .home { max-width: 860px; margin: 0 auto; padding: 72px 24px 60px; text-align: center; }
  .home h1 { font-size: 44px; font-weight: 600; color: ${SG_BLUE}; line-height: 1.1; margin-bottom: 12px; letter-spacing: -0.5px; }
  .home > p { font-size: 15px; color: #5a6a80; max-width: 460px; margin: 0 auto 52px; line-height: 1.65; font-weight: 300; }
  .doc-cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; max-width: 960px; margin: 0 auto; }

  /* INTAKE PAGE */
  .intake-page { max-width: 720px; margin: 0 auto; padding: 60px 24px 80px; }
  .intake-title { font-size: 32px; font-weight: 600; color: ${SG_BLUE}; margin-bottom: 8px; letter-spacing: -0.3px; text-align: center; }
  .intake-sub { font-size: 15px; color: #7a8a9a; text-align: center; margin-bottom: 40px; font-weight: 300; line-height: 1.6; max-width: 480px; margin-left: auto; margin-right: auto; }
  .intake-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; align-items: start; min-width: 0; }
  .intake-card { background: white; border: 1.5px solid ${SG_BORDER_GRAY}; border-radius: 10px; padding: 28px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; min-width: 0; overflow: hidden; }
  .intake-card h3 { font-size: 16px; font-weight: 600; color: #1a2332; }
  .intake-card p { font-size: 12px; color: #9aa5b4; line-height: 1.55; font-weight: 300; }
  .intake-upload-zone { border: 2px dashed #c8d4e8; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.18s; background: #fafbfc; width: 100%; }
  .intake-upload-zone:hover, .intake-upload-zone.drag { border-color: ${SG_BLUE}; background: ${SG_LIGHT}; }
  .intake-upload-icon { font-size: 32px; margin-bottom: 8px; }
  .intake-upload-zone h4 { font-size: 14px; font-weight: 500; color: #2d3748; margin-bottom: 3px; }
  .intake-upload-zone p { font-size: 11px; color: #9aa5b4; }
  .intake-paste { width: 100%; min-width: 0; border: 1.5px solid ${SG_BORDER_GRAY}; border-radius: 8px; padding: 14px; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #333; resize: vertical; min-height: 140px; outline: none; line-height: 1.6; background: #fafbfc; box-sizing: border-box; }
  .intake-paste:focus { border-color: ${SG_BLUE}; background: white; }
  .intake-files { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
  .intake-file { display: flex; align-items: center; gap: 9px; background: ${SG_LIGHT}; border-radius: 4px; padding: 6px 11px; font-size: 13px; color: ${SG_BLUE}; }
  .intake-file .fname { font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .intake-file button { background: none; border: none; color: #9aa5b4; cursor: pointer; font-size: 16px; line-height: 1; }
  .intake-file button:hover { color: #e24b4a; }
  .btn-parse-big { width: 100%; background: ${SG_BLUE}; color: white; border: none; border-radius: 8px; padding: 16px; font-size: 16px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.18s; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .btn-parse-big:hover:not(:disabled) { background: #1e4380; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(43,87,154,0.22); }
  .btn-parse-big:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .intake-or { text-align: center; font-size: 12px; color: #b0bbc8; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; margin: 4px 0; }

  /* SECTION BUILDER PAGE */
  .sections-page { max-width: 680px; margin: 0 auto; padding: 52px 24px 80px; }
  .sections-title { font-size: 28px; font-weight: 600; color: ${SG_BLUE}; margin-bottom: 6px; letter-spacing: -0.3px; }
  .sections-sub { font-size: 14px; color: #7a8a9a; margin-bottom: 28px; font-weight: 300; line-height: 1.6; }
  .section-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 28px; }
  .section-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; border: 1.5px solid ${SG_BORDER_GRAY}; background: white; transition: all 0.15s; }
  .section-row.checked { border-color: ${SG_BLUE}; background: #f0f5ff; }
  .section-row.optional { border-style: dashed; }
  .section-row.optional.checked { border-style: solid; }
  .section-checkbox { width: 20px; height: 20px; border-radius: 4px; border: 2px solid #c8d4e8; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all 0.15s; }
  .section-checkbox.checked { background: ${SG_BLUE}; border-color: ${SG_BLUE}; }
  .section-arrows { display: flex; flex-direction: column; gap: 2px; opacity: 0; transition: opacity 0.15s; }
  .section-row:hover .section-arrows { opacity: 1; }
  .arrow-btn { background: none; border: 1px solid #e2e8f0; border-radius: 3px; width: 22px; height: 20px; cursor: pointer; font-size: 9px; color: #7a8a9a; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.12s; line-height: 1; }
  .arrow-btn:hover:not(:disabled) { background: ${SG_BLUE}; border-color: ${SG_BLUE}; color: white; }
  .arrow-btn:disabled { opacity: 0.2; cursor: default; }
  .section-label { flex: 1; }
  .section-label-name { font-size: 14px; font-weight: 500; color: #1a2332; }
  .section-label-desc { font-size: 11px; color: #9aa5b4; margin-top: 2px; font-weight: 300; }
  .section-badge { font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 600; letter-spacing: 0.3px; }
  .section-badge-default { background: #edf0f5; color: #7a8a9a; }
  .section-badge-optional { background: #d5f0ec; color: #0a6554; }
  .sections-divider { border: none; border-top: 1.5px dashed #e2e8f0; margin: 10px 0; }
  .btn-continue { width: 100%; background: ${SG_BLUE}; color: white; border: none; border-radius: 8px; padding: 16px; font-size: 16px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.18s; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .btn-continue:hover { background: #1e4380; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(43,87,154,0.22); }

  /* CUSTOM PAGE */
  .custom-page { max-width: 720px; margin: 0 auto; padding: 52px 24px 80px; }
  .custom-title { font-size: 30px; font-weight: 600; color: ${SG_BLUE}; margin-bottom: 6px; letter-spacing: -0.3px; }
  .custom-sub { font-size: 14px; color: #7a8a9a; margin-bottom: 28px; font-weight: 300; line-height: 1.6; }
  .custom-prompt { width: 100%; border: 1.5px solid ${SG_BORDER_GRAY}; border-radius: 8px; padding: 16px; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #333; resize: vertical; min-height: 180px; outline: none; line-height: 1.7; background: white; box-sizing: border-box; }
  .custom-prompt:focus { border-color: ${SG_BLUE}; box-shadow: 0 0 0 3px rgba(43,87,154,0.1); }
  .custom-examples { margin: 16px 0; padding: 14px 18px; background: #f8f9fc; border-radius: 8px; border-left: 3px solid ${SG_TEAL}; }
  .custom-examples p { font-size: 12px; color: #7a8a9a; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  .custom-examples ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .custom-examples li { font-size: 13px; color: #5a6a80; cursor: pointer; padding: 2px 0; }
  .custom-examples li:hover { color: ${SG_BLUE}; text-decoration: underline; }
  @media(max-width:640px){ .intake-grid { grid-template-columns: 1fr; } }
  .doc-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 28px 24px 24px; cursor: pointer; transition: all 0.18s; text-align: left; position: relative; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .doc-card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:${SG_BLUE}; transform:scaleX(0); transition:transform 0.18s; }
  .doc-card:hover { border-color:${SG_BLUE}; transform:translateY(-2px); box-shadow:0 10px 36px rgba(43,87,154,0.14); }
  .doc-card:hover::before { transform:scaleX(1); }
  .doc-card .icon { font-size: 28px; margin-bottom: 14px; }
  .doc-card h3 { font-size: 16px; font-weight: 600; color: #1a2332; margin-bottom: 7px; }
  .doc-card p { font-size: 12px; color: #7a8a9a; line-height: 1.55; font-weight: 300; }
  .doc-card .badge { display:inline-block; font-size:10px; font-weight:600; padding:3px 9px; border-radius:4px; margin-top:14px; letter-spacing:0.4px; text-transform:uppercase; }
  .badge-a { background:${SG_LIGHT}; color:${SG_BLUE}; }
  .badge-p { background:#d5f0ec; color:#0a6554; }
  .badge-proj { background:#fde8cc; color:#7a3e00; }
  .badge-o { background:#f0f0f5; color:#555; }

  .api-notice { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:14px 18px; font-size:13px; color:#92400e; margin-bottom:20px; }
  .api-notice a { color:${SG_BLUE}; }
  .api-key-bar { display:flex; gap:10px; margin-top:10px; }
  .api-key-bar input { flex:1; border:1.5px solid #e2e8f0; border-radius:6px; padding:8px 12px; font-size:13px; font-family:'DM Sans',sans-serif; outline:none; }
  .api-key-bar input:focus { border-color:${SG_BLUE}; }
  .api-key-bar button { background:${SG_BLUE}; color:white; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; }
  .api-ok { font-size:13px; color:#1D9E75; background:#e1f5ee; border-radius:6px; padding:8px 14px; margin-bottom:20px; display:flex; align-items:center; gap:8px; }
  .api-ok button { background:none; border:none; color:#9aa5b4; cursor:pointer; font-size:12px; text-decoration:underline; margin-left:auto; }

  /* FORM LAYOUT — sidebar + main */
  .form-outer { display: flex; gap: 0; min-height: calc(100vh - 72px); }

  /* WATER SIDEBAR */
  .water-sidebar {
    width: 88px;
    flex-shrink: 0;
    background: #0e2a52;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 0 28px;
    position: sticky;
    top: 0;
    height: calc(100vh - 59px);
    overflow: hidden;
  }
  .water-label-top {
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    margin-bottom: 14px;
  }
  .water-tank {
    flex: 1;
    width: 38px;
    background: rgba(255,255,255,0.06);
    border-radius: 19px;
    border: 1.5px solid rgba(255,255,255,0.1);
    position: relative;
    overflow: hidden;
  }
  .water-fill {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    border-radius: 0 0 17px 17px;
    transition: height 0.6s cubic-bezier(0.34, 1.26, 0.64, 1);
    background: linear-gradient(180deg, #5BC8F5 0%, #2196D3 40%, #1565A8 100%);
    overflow: hidden;
  }
  .wave-wrap {
    position: absolute;
    top: -10px; left: -20px; right: -20px;
    height: 20px;
    overflow: hidden;
  }
  .wave {
    width: 200%;
    height: 20px;
    background: rgba(255,255,255,0.3);
    border-radius: 50%;
    animation: waveflow 2.4s linear infinite;
  }
  .wave2 {
    width: 200%;
    height: 20px;
    background: rgba(255,255,255,0.15);
    border-radius: 50%;
    animation: waveflow 3.2s linear infinite reverse;
    margin-top: -14px;
  }
  @keyframes waveflow { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

  /* bubbles */
  .bubble {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    animation: bubblerise linear infinite;
  }
  @keyframes bubblerise {
    0% { transform: translateY(0) translateX(0); opacity:0.6; }
    50% { opacity:0.4; transform: translateY(-40%) translateX(4px); }
    100% { transform: translateY(-100%) translateX(-2px); opacity:0; }
  }

  .water-pct {
    font-size: 13px;
    font-weight: 600;
    color: white;
    margin-top: 12px;
  }
  .water-label-bottom {
    font-size: 9px;
    font-weight: 500;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    margin-top: 4px;
    text-align: center;
    line-height: 1.3;
  }

  /* MAIN FORM AREA */
  .form-main { flex: 1; min-width: 0; padding: 36px 40px 80px 36px; }
  .form-back { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#7a8a9a; cursor:pointer; margin-bottom:22px; transition:color 0.15s; background:none; border:none; padding:0; font-family:'DM Sans',sans-serif; }
  .form-back:hover { color:${SG_BLUE}; }
  .form-title { font-size:28px; font-weight:600; color:${SG_BLUE}; margin-bottom:4px; letter-spacing:-0.3px; }
  .form-subtitle { font-size:13px; color:#7a8a9a; margin-bottom:26px; font-weight:300; }

  .section { background:white; border:1px solid ${SG_BORDER_GRAY}; border-radius:8px; padding:24px 28px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  .section-title { font-size:11px; font-weight:700; color:white; background:${SG_BLUE}; text-transform:uppercase; letter-spacing:1.2px; margin:-24px -28px 20px; padding:10px 18px; border-radius:7px 7px 0 0; display:flex; align-items:center; gap:8px; }
  .section-title .pill { font-size:10px; font-weight:600; padding:2px 8px; border-radius:3px; background:rgba(255,255,255,0.2); color:white; letter-spacing:0; text-transform:none; }
  .section-title .pill.green { background:rgba(79,168,160,0.35); color:white; }

  .upload-outer { border:2px dashed #c8d4e8; border-radius:6px; transition:all 0.18s; background:#fafbfc; }
  .upload-outer:hover, .upload-outer.drag { border-color:${SG_BLUE}; background:${SG_LIGHT}; }
  .upload-inner { padding:26px 30px; text-align:center; cursor:pointer; }
  .upload-icon-big { font-size:34px; margin-bottom:9px; }
  .upload-inner h4 { font-size:14px; font-weight:500; color:#2d3748; margin-bottom:3px; }
  .upload-inner p { font-size:12px; color:#9aa5b4; font-weight:300; }
  .uploaded-list { padding:10px 14px; display:flex; flex-direction:column; gap:5px; }
  .uploaded-file { display:flex; align-items:center; gap:9px; background:${SG_LIGHT}; border-radius:4px; padding:6px 11px; font-size:13px; color:${SG_BLUE}; }
  .uploaded-file .fname { font-weight:500; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .uploaded-file .fsize { font-size:11px; color:#9aa5b4; }
  .uploaded-file button { background:none; border:none; color:#9aa5b4; cursor:pointer; font-size:16px; line-height:1; padding:0 2px; }
  .uploaded-file button:hover { color:#e24b4a; }

  .paste-box { border:1.5px solid #e2e8f0; border-radius:10px; padding:11px 13px; background:#fafbfc; margin-top:12px; }
  .paste-box textarea { width:100%; border:none; background:transparent; font-size:13px; font-family:'DM Sans',sans-serif; color:#1a2332; resize:vertical; min-height:90px; outline:none; line-height:1.6; }

  .parse-bar { margin-top:14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .btn-parse { background:${SG_TEAL}; color:white; border:none; border-radius:9px; padding:10px 20px; font-size:13px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.18s; }
  .btn-parse:hover:not(:disabled) { background:#3a9898; transform:translateY(-1px); }
  .btn-parse:disabled { opacity:0.5; cursor:not-allowed; }
  .parse-hint { font-size:12px; color:#9aa5b4; font-style:italic; }
  .parsed-banner { display:flex; align-items:center; gap:8px; font-size:13px; color:#1D9E75; background:#e1f5ee; border-radius:8px; padding:8px 13px; margin-top:10px; }

  .field-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .field { display:flex; flex-direction:column; gap:5px; }
  .field label { font-size:11px; font-weight:500; color:#4a5568; letter-spacing:0.2px; display:flex; align-items:center; gap:4px; }
  .field label .req { color:#e24b4a; }
  .field label .opt { color:#b0bbc8; font-weight:400; font-style:italic; font-size:10px; }
  .field .ai-badge { font-size:10px; color:${SG_TEAL}; background:#d5f0ec; padding:1px 6px; border-radius:3px; font-weight:600; letter-spacing:0.3px; }
  .field input, .field select, .field textarea {
    border:1px solid ${SG_BORDER_GRAY}; border-radius:4px; padding:8px 11px;
    font-size:13px; font-family:'DM Sans',sans-serif; color:#333333;
    background:white; transition:border-color 0.15s, box-shadow 0.15s; outline:none;
  }
  .field input:focus, .field select:focus, .field textarea:focus { border-color:${SG_BLUE}; box-shadow:0 0 0 3px rgba(43,87,154,0.1); }
  .field input.err, .field select.err, .field textarea.err { border-color:#e24b4a; background:#fff8f8; }
  .field input.ai-filled, .field select.ai-filled, .field textarea.ai-filled { border-color:${SG_TEAL}; background:#f0fdf9; }
  .field textarea { resize:vertical; min-height:82px; line-height:1.5; }

  .err-banner { background:#fff5f5; border:2px solid #e24b4a; border-radius:6px; padding:14px 18px; font-size:13px; color:#991b1b; margin-bottom:14px; display:flex; gap:9px; white-space:pre-line; line-height:1.6; }

  .gen-bar { background:white; border:1px solid ${SG_BORDER_GRAY}; border-radius:6px; padding:20px 28px; display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:18px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  .revision-box { background:white; border:1px solid ${SG_TEAL}; border-radius:6px; padding:22px 28px; margin-top:16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  .revision-box h4 { font-size:14px; font-weight:600; color:${SG_BLUE}; margin-bottom:4px; }
  .revision-box p { font-size:12px; color:#7a8a9a; margin-bottom:12px; font-weight:300; }
  .revision-box textarea { width:100%; border:1.5px solid #e2e8f0; border-radius:6px; padding:10px 12px; font-size:13px; font-family:'DM Sans',sans-serif; color:#333; resize:vertical; min-height:90px; outline:none; line-height:1.6; }
  .revision-box textarea:focus { border-color:${SG_BLUE}; }
  .revision-actions { display:flex; gap:10px; margin-top:10px; justify-content:flex-end; }
  .btn-revise { background:${SG_TEAL}; color:white; border:none; border-radius:4px; padding:9px 20px; font-size:13px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.18s; }
  .btn-revise:hover:not(:disabled) { background:#3a9898; }
  .btn-revise:disabled { opacity:0.5; cursor:not-allowed; }
  .gen-info { font-size:13px; color:#7a8a9a; font-weight:300; line-height:1.7; }
  .gen-info strong { color:#333333; font-weight:600; }
  .btn-gen { background:${SG_BLUE}; color:white; border:none; border-radius:4px; padding:12px 26px; font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.18s; display:flex; align-items:center; gap:7px; white-space:nowrap; letter-spacing:0.2px; }
  .btn-gen:hover:not(:disabled) { background:#1e4380; box-shadow:0 4px 16px rgba(43,87,154,0.28); }
  .btn-gen:disabled { opacity:0.55; cursor:not-allowed; }

  .overlay { position:fixed; inset:0; background:rgba(18,26,42,0.65); display:flex; align-items:center; justify-content:center; z-index:200; backdrop-filter:blur(4px); }
  .overlay-card { background:white; border-radius:8px; padding:40px 44px; text-align:center; max-width:380px; width:90%; box-shadow:0 24px 80px rgba(0,0,0,0.2); }
  .overlay-logo { height:40px; width:auto; margin:0 auto 16px; display:block; background:white; border-radius:4px; padding:4px 8px; }
  .spinner { width:46px; height:46px; border-radius:50%; border:3px solid ${SG_LIGHT}; border-top-color:${SG_BLUE}; animation:spin 0.85s linear infinite; margin:0 auto 16px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .overlay-card h3 { font-size:17px; font-weight:600; color:${SG_BLUE}; margin-bottom:6px; }
  .overlay-card p { font-size:13px; color:#7a8a9a; font-weight:300; line-height:1.5; }
  .steps { margin-top:16px; text-align:left; }
  .step { display:flex; align-items:center; gap:9px; font-size:12px; padding:5px 0; color:#b0bbc8; }
  .step.done { color:#1D9E75; }
  .step.active { color:${SG_BLUE}; font-weight:500; }
  .dot { width:7px; height:7px; border-radius:50%; background:#e2e8f0; flex-shrink:0; }
  .dot.done { background:#1D9E75; }
  .dot.active { background:${SG_BLUE}; animation:pulse 1s ease infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.75)} }

  /* footer bar */
  .app-footer { background:${SG_BLUE}; border-top:2px solid ${SG_TEAL}; padding:10px 40px; display:flex; align-items:center; justify-content:space-between; }
  .app-footer span { font-size:11px; color:rgba(255,255,255,0.45); }

  @media(max-width:680px){
    .doc-cards{grid-template-columns:1fr 1fr;}
    .field-grid{grid-template-columns:1fr;}
    .water-sidebar{width:60px;}
    .water-tank{width:28px;}
    .form-main{padding:24px 20px 60px 18px;}
    .home h1{font-size:32px;}
    .gen-bar{flex-direction:column;align-items:stretch;}
    .header{padding:0 20px;}
    .intake-grid{grid-template-columns:1fr;}
  }
`;

// ── fields ────────────────────────────────────────────────────────────────────

const PIPELINE_FIELDS = [
  // Pipeline is auto-set based on doc type — not shown as editable field
  { key:"pipeline", label:"Pipeline", required:true, type:"hidden" },
  { key:"generatedBy",          label:"Generated By (your name or email)", required:true, placeholder:"Jane Smith", persist:true },
  { key:"dealAmount",           label:"Deal Amount",                    required:true,  placeholder:"$150,000" },
  { key:"closeDate",            label:"Expected Close Date",            required:true,  type:"date" },
  { key:"dealSource",           label:"Deal Source",                    required:true,  type:"select", options:[
    {value:"",                  label:"Select source…"},
    {value:"Internal Sales",    label:"Internal Sales"},
    {value:"Prior Relationship",label:"Prior Relationship"},
    {value:"Organic Web Traffic",label:"Organic Web Traffic"},
    {value:"Outbound Sales",    label:"Outbound Sales"},
    {value:"Paid Advertisement",label:"Paid Advertisement"},
    {value:"Events",            label:"Events"},
    {value:"WaterSolve",        label:"WaterSolve"},
  ]},
  { key:"closeProbability",     label:"Probability of Closing (%)",     required:false, placeholder:"75", type:"number" },
  { key:"sgContactName",        label:"Primary SG Contact Name",        required:true,  placeholder:"Ted Winkelman" },
  { key:"sgContactEmail",       label:"Primary SG Contact Email",       required:true,  placeholder:"twinkelman@solutionmgt.com" },
  { key:"customerContactName",  label:"Primary Customer Contact Name",  required:true,  placeholder:"John Doe" },
  { key:"customerContactEmail", label:"Primary Customer Contact Email", required:true,  placeholder:"jdoe@client.com" },
  // Cost breakdown fields — parsed from uploaded docs, pushed to HubSpot
  { key:"managementCost",  label:"Management Cost",  required:false, placeholder:"$0" },
  { key:"equipmentCost",   label:"Equipment Cost",   required:false, placeholder:"$0" },
  { key:"laborCost",       label:"Labor Cost",        required:false, placeholder:"$0" },
  { key:"technologyCost",  label:"Technology Cost",   required:false, placeholder:"$0" },
];

const ASSESSMENT_FIELDS = [
  { key:"clientLegalName",    label:"Client Legal Name",       required:true,  placeholder:"Acme Corporation" },
  { key:"clientShortName",    label:"Client Short Name",       required:false, placeholder:"Acme" },
  { key:"facilityName",       label:"Facility Name",           required:false, placeholder:"Indianapolis Plant" },
  { key:"facilityAddress",    label:"Facility Address",        required:false, placeholder:"123 Industrial Blvd, Indianapolis, IN 46201" },
  { key:"industry",           label:"Industry / What They Do", required:false, placeholder:"Food & beverage manufacturing" },
  { key:"assessmentDate",     label:"Date of Site Visit",      required:false, type:"date" },
  { key:"assessmentTeam",     label:"SG Assessment Team",      required:false, placeholder:"Jane Smith – Regional Manager" },
  { key:"systemsAssessed",    label:"Systems Assessed",        required:false, placeholder:"Wastewater treatment, boilers, cooling towers" },
  { key:"regulatoryAuthority",label:"Regulatory Authority",    required:false, placeholder:"Indiana IDEM" },
  { key:"permitNumber",       label:"Permit Number",           required:false, placeholder:"IND-0012345" },
  { key:"executiveSummary",   label:"Executive Summary",       required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or summarize the key findings and context." },
  { key:"inScope",            label:"Key Findings / Systems Assessed", required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or describe findings per system." },
  { key:"additionalInstructions", label:"Any Additional Instructions", required:false, full:true, type:"textarea", placeholder:"Optional — guide Claude on tone, length, formality, or emphasis.\n\nExamples: \"Keep it concise\", \"Use a formal tone\", \"Emphasize compliance risk throughout\"", help:"Adjust tone, length, formality, emphasis, or specific sections." },
];

const PROPOSAL_FIELDS = [
  { key:"clientLegalName",     label:"Client Legal Name",            required:true,  placeholder:"Acme Corporation" },
  { key:"clientShortName",     label:"Client Short Name",            required:false, placeholder:"Acme" },
  { key:"facilityAddress",     label:"Facility Address",             required:false, placeholder:"123 Industrial Blvd, Indianapolis, IN 46201" },
  { key:"proposalDate",        label:"Proposal Date",                required:false, type:"date" },
  { key:"monthlyFeeTotal",     label:"Total Monthly Fee",            required:false, placeholder:"$12,500" },
  { key:"contractLengthDays",  label:"Contract Length (days)",       required:true,  placeholder:"365", type:"number" },
  { key:"timeline",            label:"Project Timeline (optional)",  required:false, full:true, type:"textarea", placeholder:"Optional — paste or describe a timeline and it will be included as a table.\n\nExample: Weeks 1-4: Procurement | Weeks 5-6: Installation | Week 7: Commissioning" },
  { key:"includeSignature",    label:"Include Signature Block?",     required:false, type:"select", options:[{value:"",label:"No signature block"},{value:"yes",label:"Yes — include signature block"}] },
  { key:"executiveSummary",    label:"Executive Summary",            required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or describe the service being proposed and the value to the client." },
  { key:"inScope",             label:"In-Scope Services",            required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or list what Solution Group will provide under this agreement." },
  { key:"additionalInstructions", label:"Any Additional Instructions", required:false, full:true, type:"textarea", placeholder:"Optional — guide Claude on tone, length, formality, or emphasis.\n\nExamples: \"Keep it concise and executive-friendly\", \"Use a more technical tone\", \"Emphasize regulatory compliance\"", help:"Adjust tone, length, formality, emphasis, or specific sections." },
];

const OTHER_FIELDS = [
  { key:"documentTitle", label:"Document Title / Purpose", required:true, placeholder:"Describe what document you need" },
  { key:"clientName",    label:"Client / Company Name",    required:true, placeholder:"Company name" },
];

const PROJECT_PROPOSAL_FIELDS = [
  { key:"clientLegalName",    label:"Client Legal Name",          required:true,  placeholder:"Sabrosura Foods, LLC" },
  { key:"clientShortName",    label:"Client Short Name",          required:false, placeholder:"Sabrosura" },
  { key:"projectTitle",       label:"Project Title",              required:true,  placeholder:"pH Adjust System Replacement" },
  { key:"proposalDate",       label:"Proposal Date",              required:false, type:"date" },
  { key:"projectLengthDays",  label:"Estimated Project Length (days)", required:true, placeholder:"60", type:"number" },
  { key:"timeline",           label:"Project Timeline (optional)", required:false, full:true, type:"textarea", placeholder:"Optional — describe a timeline and it will be included as a table.\n\nExample: Weeks 1-4: Parts procurement | Weeks 5-6: Build and ship | Weeks 7-8: Install and startup" },
  { key:"includeSignature",   label:"Include Signature Block?",   required:false, type:"select", options:[{value:"",label:"No signature block"},{value:"yes",label:"Yes — include signature block"}] },
  { key:"executiveSummary",   label:"Executive Summary",          required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or describe the system and the value it delivers to the client." },
  { key:"inScope",            label:"In-Scope Deliverables",      required:false, full:true, type:"textarea", placeholder:"Auto-populated from uploaded files — or list what Solution Group will supply, install, and deliver." },
  { key:"additionalInstructions", label:"Any Additional Instructions", required:false, full:true, type:"textarea",
    placeholder:"Optional — guide Claude on tone, length, formality, emphasis, or anything else.\n\nExamples: \"Keep it concise and executive-friendly\", \"Use a more technical tone\", \"Emphasize regulatory compliance throughout\"",
    help:"Adjust tone, length, formality, emphasis, or specific sections." },
];

const DOC_TYPES = [
  { id:"assessment", icon:"🔍", title:"Assessment",         desc:"Operational & technical findings report with recommendations. No pricing.", badge:"Assessment",  badgeClass:"badge-a" },
  { id:"proposal",   icon:"📄", title:"Recurring Proposal", desc:"4–5 page O&M service proposal with service confirmation and pricing summary.", badge:"O&M Proposal", badgeClass:"badge-p" },
  { id:"project",    icon:"🏗️", title:"Project Proposal",   desc:"Full capital project proposal: scope, architecture, schedule, itemized pricing, and signature block.", badge:"CapEx Project", badgeClass:"badge-proj" },
  { id:"custom",     icon:"✏️", title:"Custom Document",    desc:"Freeform — describe exactly what you need. No predefined structure or required fields.", badge:"Freeform", badgeClass:"badge-o" },
];

const EMAILJS_SERVICE  = 'service_71nz8kc';
const EMAILJS_TEMPLATE = 'template_ex35j5g';
const EMAILJS_KEY      = 'uITaQIb_MQzLk8dQ7';
const EMAIL_DELAY_MS   = 0; // Send immediately after generation
const PARSE_STEPS = ["Reading uploaded files","Extracting data with Claude","Populating form fields"];
const GEN_STEPS   = ["Extracting file content","Sending to server","Building branded document","Preparing download"];

// ── helpers ───────────────────────────────────────────────────────────────────

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

// Calculate end date by adding days to a YYYY-MM-DD date string
function calculateEndDate(startDate, days) {
  if (!startDate || !days || isNaN(Number(days))) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().split('T')[0];
}

async function readDocxAsText(file) {
  // Load mammoth from CDN if not already loaded
  if (!window.mammoth) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("Failed to load mammoth"));
      document.head.appendChild(s);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function readSpreadsheetAsText(file) {
  // Load SheetJS from CDN if not already loaded
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("Failed to load SheetJS"));
      document.head.appendChild(s);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: "array" });
  // Convert each sheet to CSV text and concatenate
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = window.XLSX.utils.sheet_to_csv(sheet, { skipHidden: true });
    // Filter out mostly-empty rows to keep token count reasonable
    const filtered = csv.split('\n')
      .filter(row => row.replace(/,/g, '').trim().length > 0)
      .join('\n');
    if (filtered.trim()) {
      parts.push(`[Sheet: ${sheetName}]\n${filtered}`);
    }
  }
  return parts.join('\n\n');
}

function buildParsePrompt(docType, pastedText, fileNames) {
  const allKeys = [
    ...PIPELINE_FIELDS,
    ...(docType==="assessment" ? ASSESSMENT_FIELDS : docType==="proposal" ? PROPOSAL_FIELDS : docType==="project" ? PROJECT_PROPOSAL_FIELDS : OTHER_FIELDS),
  ].map(f => f.key).filter(k => k !== 'generatedBy' && k !== 'pipeline');
  return `You are a data extraction assistant for Solution Group. Extract fields from the provided files/text.
${pastedText ? `\nPASTED TEXT:\n${pastedText}\n` : ""}
${fileNames.length ? `Files provided: ${fileNames.join(", ")}` : ""}

CRITICAL: Return ONLY a flat JSON object — every value must be a plain string or number. No nested objects, no arrays, no null. Use empty string "" for anything not found. Do not include markdown fences or any text outside the JSON.

Extract values for these keys:
${JSON.stringify(allKeys)}

FIELD MAPPING GUIDANCE:
- "sgContactName": look for SG rep or "Prepared By". Default to "Ted Winkelman" if not found.
- "sgContactEmail": default to "twinkelman@solutionmgt.com" if not found.
- "dealAmount": look for ANY total dollar figure — "TOTAL PROJECT INVESTMENT", "Total", "Grand Total". Include $ and commas exactly, e.g. "$209,509.48". Most important field.
- "closeDate": use proposal date as best-guess. Format YYYY-MM-DD.
- "proposalDate": look for "Proposal Date" or document date. Format YYYY-MM-DD.
- "clientLegalName" / "clientShortName": look for "Prepared For" or client name on cover.
- "projectTitle": main project heading or title.
- "executiveSummary": executive summary text (truncate to 500 chars if very long).
- "inScope": in-scope deliverables as a single string with items separated by newlines.
- "managementCost": management, O&M, or overhead cost line from pricing table. Include $ and commas.
- "equipmentCost": equipment, parts, or materials cost from pricing table. Include $ and commas.
- "laborCost": labor, installation, or engineering labor cost from pricing table. Include $ and commas.
- "technologyCost": technology, software, OptiClear, or monitoring cost from pricing table. Include $ and commas.
- "projectLengthDays": estimated project duration — convert to days (1 week = 7 days, 1 month = 30 days).
- "contractLengthDays": contract duration — convert to days (1 month = 30 days, 1 year = 365 days).

Dates → YYYY-MM-DD. closeProbability → number 0-100. All other values → plain strings.`;
}

function buildDocPrompt(docType, formData, pastedText, uploadedFiles) {
  const fields = JSON.stringify(formData, null, 2);
  const pasteNote = pastedText.trim() ? `\n\nAdditional context:\n${pastedText}` : "";
  const fileNote  = uploadedFiles.length ? `\nAttached: ${uploadedFiles.map(f=>f.name).join(", ")}` : "";

  if (docType==="assessment") return `You are the Solution Group site assessment generator.
SG: Environmental Management Solutions, Inc. d/b/a Solution Group | 6239 S. East Street, Suite F, Indianapolis, IN 46227 | (800) 465-8200 | solutionmgt.com

INTAKE:
${fields}${pasteNote}${fileNote}

Generate a complete site assessment:
1. Executive Summary  2. Site Overview  3. Regulatory Context  4. Systems Assessment (per system: condition, findings, risks)  5. Staffing & Operations  6. Monitoring & Data Management  7. Prioritized Recommendations (Quick Wins / Medium-Term / Major Projects)  8. Conclusion

RULES: No pricing/signatures. Link findings to customer goals. Use [To be confirmed] for missing fields. Markdown ## headers. Title: "SITE ASSESSMENT REPORT".
${formData.additionalInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER: ${formData.additionalInstructions}` : ""}`;

  if (docType==="proposal") return `You are the Solution Group executive proposal generator.
SG: Environmental Management Solutions, Inc. d/b/a Solution Group | 6239 S. East Street, Suite F, Indianapolis, IN 46227 | (800) 465-8200 | solutionmgt.com
Default signatory: ${formData.sgSignatoryName||"Mike Silver"}, VP Operations | Contract: 36mo, 12mo auto-renew, 60-day notice, 3% escalator | Bill Back: cost+10%, $5k threshold | OT: $125/hr, 4hr min

INTAKE:
${fields}${pasteNote}${fileNote}

Generate EXACTLY 5 sections:
1. Proposal Introduction (1 paragraph)  2. Service Confirmation (2-3 sentences)  3. Commercial Summary (pricing table + context)  4. Key Assumptions & Exclusions (4-8 bullets)  5. Next Steps (3-5 bullets)

RULES: Max 5 pages. No SOW/appendices/signature blocks. Title: "EXECUTIVE SERVICE PROPOSAL". Valid 30 days.
${formData.additionalInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER: ${formData.additionalInstructions}` : ""}`;

  if (docType==="project") return `You are the Solution Group capital project proposal generator.
SG: Environmental Management Solutions, Inc. d/b/a Solution Group | 6239 S. East Street, Suite F, Indianapolis, IN 46227 | (800) 465-8200 | solutionmgt.com

INTAKE:
${fields}${pasteNote}${fileNote}

Generate a complete capital project proposal with EXACTLY 8 numbered sections:

1. Executive Summary
   - Two paragraphs: (1) system description and problem solved, (2) value and outcome for client
   - Do not include pricing here

2. Project Scope
   - In-Scope Deliverables: bulleted list of exactly what SG will supply, install, and deliver
   - Out-of-Scope: bulleted list of exclusions

3. System Architecture
   - 3–5 subsections describing the technology, key components, and how the system works
   - Technical but readable by a plant manager or operations executive

4. [Site-Specific Technical Section — title varies by project]
   - e.g., "Hydraulic Integration", "Electrical Scope", "Civil Requirements"
   - Include only if there is meaningful standalone site-specific content; if not, skip and renumber sections 5–8 accordingly

5. Implementation Schedule
   - Table format: Phase | Key Activities | Est. Duration
   - Alternate light gray background on phase rows
   - Phases should be logical and sequential (Engineering → Fabrication → Installation → Commissioning)

6. Pricing Summary
   - Table format: Activity/Description | Qty | Rate | Amount
   - Total row in bold
   - Pricing notes below table (3–5 bullets)
   - Payment milestones: ${formData.paymentMilestones || "50% deposit / 25% at mechanical completion / 25% at project handover"}
   - "Pricing is valid for 30 days from proposal date."

7. Terms & Conditions
   - Warranty: ${formData.warrantyDuration || "6 months"} on equipment and installation; sensor calibration and reagent consumables excluded
   - Change Orders clause: "Any changes to the agreed scope of work must be submitted in writing and approved by both parties prior to execution. Changes may affect project schedule and pricing."
   - Assumptions & Exclusions: bulleted list
   - Close with: "Questions? Contact the Solution Group project team to discuss this proposal."

8. Proposal Acceptance
   - Two-column signature block: Client (left) | Solution Group (right)
   - Four lines each: Signature / Print Name / Title / Date

RULES:
- This is the full scope document — include complete technical detail
- If rebranding an uploaded document: reproduce ALL content verbatim, change only visual formatting
- Use [To be confirmed] for any missing required field
- Markdown ## for section headers, ### for subsections
- Title: "PROJECT PROPOSAL" then client name and project title
- Prepared by: ${formData.preparedBy || "Solution Group Engineering Team"}
- Payment milestones: 50% deposit / 25% at mechanical completion / 25% at project handover
${formData.additionalInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER: ${formData.additionalInstructions}` : ""}`;

  return `Generate a professional document for Solution Group (water treatment & facility management).
INTAKE:\n${fields}${pasteNote}${fileNote}\nProfessional tone, markdown formatting, appropriate sections for the described purpose.`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type:"text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

async function callClaude(messageContent, maxTokens=8000, attempt=1) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch("/api/anthropic-proxy", {
      method:"POST",
      signal: controller.signal,
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:maxTokens, messages:[{role:"user",content:messageContent}] }),
    });
    clearTimeout(tid);
    if (!resp.ok) {
      const e = await resp.json().catch(()=>({}));
      const msg = e?.error?.message || `API error ${resp.status}`;
      if (attempt < 3 && (resp.status === 529 || resp.status >= 500)) {
        await new Promise(r => setTimeout(r, 4000 * attempt));
        return callClaude(messageContent, maxTokens, attempt + 1);
      }
      throw new Error(msg);
    }
    const data = await resp.json();
    return data.content.map(b=>b.text||"").join("\n");
  } catch(e) {
    clearTimeout(tid);
    if (e.name === "AbortError") throw new Error("Request timed out — try reducing pasted text or using fewer files.");
    if (attempt < 3 && e.message.includes("network")) {
      await new Promise(r => setTimeout(r, 3000));
      return callClaude(messageContent, maxTokens, attempt + 1);
    }
    throw e;
  }
}

// ── Water sidebar component ───────────────────────────────────────────────────

function WaterBar({ pct }) {
  // clamp between 4% (so tank never looks totally empty) and 98%
  const fillPct = Math.max(4, Math.min(98, pct));
  const isComplete = pct >= 100;

  const messages = [
    { at:0,   text:"Empty" },
    { at:15,  text:"Getting started" },
    { at:35,  text:"Taking shape" },
    { at:55,  text:"Looking good" },
    { at:75,  text:"Almost there" },
    { at:95,  text:"Ready!" },
  ];
  const msg = [...messages].reverse().find(m => pct >= m.at) || messages[0];

  return (
    <div className="water-sidebar">
      <div className="water-label-top">Detail level</div>
      <div className="water-tank">
        <div className="water-fill" style={{ height:`${fillPct}%` }}>
          <div className="wave-wrap">
            <div className="wave" />
            <div className="wave2" />
          </div>
          {/* bubbles */}
          {[0,1,2,3].map(i => (
            <div key={i} className="bubble" style={{
              width: `${5+i*2}px`, height:`${5+i*2}px`,
              left:`${15+i*18}%`,
              bottom:`${10+i*12}%`,
              animationDuration:`${2.2+i*0.7}s`,
              animationDelay:`${i*0.4}s`,
            }} />
          ))}
        </div>
      </div>
      <div className="water-pct" style={{ color: isComplete ? "#5BC8F5" : "white" }}>
        {Math.round(pct)}%
      </div>
      <div className="water-label-bottom">{msg.text}</div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {

  const [page,        setPage]        = useState("home");
  const [docType,     setDocType]     = useState(null);
  const [formData,    setFormData]    = useState(() => {
    const saved = localStorage.getItem("sg_generated_by");
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    const defaultCloseDate = threeMonths.toISOString().split('T')[0];
    return {
      closeDate: defaultCloseDate,
      ...(saved && saved.trim() && saved !== "Proposal Generator" ? { generatedBy: saved } : {}),
    };
  });
  const [aiKeys,      setAiKeys]      = useState(new Set());
  const [pastedText,  setPastedText]  = useState("");
  const [files,       setFiles]       = useState([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [errors,      setErrors]      = useState({});
  const [parsing,     setParsing]     = useState(false);
  const [parseStep,   setParseStep]   = useState(0);
  const [parsed,      setParsed]      = useState(false);
  const [parseErr,    setParseErr]    = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [genStep,     setGenStep]     = useState(0);
  const [genErr,      setGenErr]      = useState("");
  const [generated,    setGenerated]   = useState(false);
  const [revisions,    setRevisions]   = useState("");
  const [lastConfig,              setLastConfig]             = useState(null);
  const [lastFileContents,        setLastFileContents]        = useState([]);
  const [accumulatedInstructions, setAccumulatedInstructions] = useState("");
  const [lastDealId,   setLastDealId]  = useState(null);
  const [revisionCount, setRevisionCount] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customFiles,  setCustomFiles]  = useState([]);
  const [customErr,    setCustomErr]    = useState("");
  const [customGenerating, setCustomGenerating] = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const [skipHubspot,  setSkipHubspot]  = useState(false);
  const [hubspotStatus, setHubspotStatus] = useState(null); // null | {state:'working'|'done'|'error', text}
  const emailTimerRef = useRef(null);

  const loadEmailJS = () => new Promise((res, rej) => {
    if (window.emailjs) { res(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { window.emailjs.init(EMAILJS_KEY); res(); };
    s.onerror = () => rej(new Error('Failed to load EmailJS'));
    document.head.appendChild(s);
  });

  const scheduleEmail = (data) => {
    // Cancel any pending timer — revision resets the 10-minute clock
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(async () => {
      try {
        await loadEmailJS();
        await window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          client_name:       data.clientName || 'Unknown Client',
          doc_type:          data.docType === 'project' ? 'Project Proposal' : data.docType === 'proposal' ? 'Recurring Proposal' : 'Assessment',
          deal_amount:       data.dealAmount || 'Not specified',
          pipeline:          data.pipeline || 'Not specified',
          sg_contact:        data.sgContactName || 'Ted Winkelman',
          customer_contact:  data.customerContactName || 'Not specified',
          close_date:        data.closeDate || 'Not specified',
          generated_by:      data.generatedBy || 'Not specified',
          generated_at:      new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }),
          hubspot_deal:      data.dealId ? `Deal ID: ${data.dealId}` : 'See HubSpot',
        });
        console.log('✓ Approval email sent');
      } catch(e) {
        console.warn('Email send failed (non-blocking):', e.message);
      }
    }, EMAIL_DELAY_MS);
  };

  // Persistent drag ref — survives React re-renders so idx values stay correct
  const sectionDragRef = React.useRef({ active:false, fromIdx:-1, toIdx:-1 });
  const sectionStateRef = React.useRef([]);
  const fileRef = useRef();

  const selectDoc = (type) => {
    setDocType(type); setErrors({});
    setParsed(false); setParseErr(""); setGenErr("");
    setGenerated(false); setRevisions(""); setLastConfig(null); setLastFileContents([]); setAccumulatedInstructions(""); setLastDealId(null); setRevisionCount(0);
    setFormData(prev => {
      const threeMonths = new Date(); threeMonths.setMonth(threeMonths.getMonth() + 3);
      const defaultPipeline = type === "project" ? "Project" : type === "proposal" ? "Recurring" : "";
      return { closeDate: threeMonths.toISOString().split("T")[0], generatedBy: prev.generatedBy || localStorage.getItem("sg_generated_by") || "", optionalSections: [], sectionOrder: null, pipeline: defaultPipeline };
    });
    setPage(type === 'assessment' || type === 'custom' ? 'form' : 'sections');
  };

  const startIntake = (type) => {
    if (type === 'custom') {
      setCustomPrompt(""); setCustomFiles([]); setCustomErr("");
      setPage("custom");
      return;
    }
    setDocType(null); setFormData({}); setErrors({});
    setPastedText(""); setFiles([]); setAiKeys(new Set());
    setParsed(false); setParseErr(""); setGenErr("");
    setGenerated(false); setRevisions(""); setLastConfig(null); setLastFileContents([]); setAccumulatedInstructions(""); setLastDealId(null); setRevisionCount(0); setFormData(prev => {
      const threeMonths = new Date(); threeMonths.setMonth(threeMonths.getMonth() + 3);
      return { closeDate: threeMonths.toISOString().split("T")[0], generatedBy: prev.generatedBy || localStorage.getItem("sg_generated_by") || "", optionalSections: [] };
    });
    setPage("intake");
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt.trim() && !customFiles.length) { setCustomErr("Describe what you need or upload a file first."); return; }
    setCustomErr(""); setCustomGenerating(true);
    try {
      // Extract file text
      const fileContents = [];
      for (const f of customFiles) {
        if (f.name.endsWith(".docx") || f.type.includes("wordprocessingml")) {
          const text = await readDocxAsText(f);
          fileContents.push(`[Document: ${f.name}]\n${text}`);
        } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.type.includes("spreadsheetml") || f.type.includes("ms-excel")) {
          const text = await readSpreadsheetAsText(f);
          fileContents.push(`[Spreadsheet: ${f.name}]\n${text}`);
        } else if (f.name.endsWith(".csv") || f.type==="text/csv" || f.type==="text/plain") {
          const text = await f.text();
          fileContents.push(`[File: ${f.name}]\n${text}`);
        } else if (f.type === "application/pdf") {
          fileContents.push(`[PDF: ${f.name} — attached]`);
        }
      }
      const resp = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: "custom",
          formData: { customPrompt, additionalInstructions: customPrompt },
          pastedText: "",
          fileContents,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}));
        throw new Error(err?.error || `Server error ${resp.status}`);
      }
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const dateShort = `${now.getMonth()+1}.${String(now.getDate()).padStart(2,'0')}`;
      a.href = dlUrl;
      a.download = `SG Custom Document - ${dateShort}.docx`;
      a.click();
      URL.revokeObjectURL(dlUrl);
      setCustomGenerating(false);
    } catch(e) {
      setCustomGenerating(false);
      setCustomErr(`Generation failed: ${e.message}`);
    }
  };

  const handleIntakeParse = async () => {
    if (!files.length && !pastedText.trim()) { setParseErr("Add a file or paste some context first."); return; }
    setParseErr(""); setParsing(true); setParseStep(0);
    try {
      const msgContent = [];
      for (const f of files) {
        if (f.type === "application/pdf") {
          const b64 = await readFileAsBase64(f);
          msgContent.push({ type:"document", source:{type:"base64",media_type:"application/pdf",data:b64} });
        } else if (f.type.startsWith("image/")) {
          const b64 = await readFileAsBase64(f);
          msgContent.push({ type:"image", source:{type:"base64",media_type:f.type,data:b64} });
        } else if (f.name.endsWith(".docx") || f.type.includes("wordprocessingml")) {
          const text = await readDocxAsText(f);
          msgContent.push({ type:"text", text:"[Document: " + f.name + "]\n" + text });
        } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.type.includes("spreadsheetml") || f.type.includes("ms-excel")) {
          const text = await readSpreadsheetAsText(f);
          msgContent.push({ type:"text", text:"[Spreadsheet: " + f.name + "]\n" + text });
        } else if (f.name.endsWith(".csv") || f.type==="text/csv" || f.type==="text/plain") {
          const text = await f.text();
          msgContent.push({ type:"text", text:"[File: " + f.name + "]\n" + text });
        }
      }
      setParseStep(1);

      const allKeys = [
        ...PIPELINE_FIELDS,
        ...ASSESSMENT_FIELDS,
        ...PROPOSAL_FIELDS,
        ...PROJECT_PROPOSAL_FIELDS,
      ].map(f => f.key).filter((k,i,a) => a.indexOf(k) === i) // dedupe
       .filter(k => k !== 'generatedBy' && k !== 'pipeline'); // never parse these from docs

      const prompt = `You are a data extraction assistant for Solution Group. Extract fields from the provided files/text and determine what type of document this is.

${pastedText ? "PASTED TEXT:\n" + pastedText + "\n" : ""}
${files.length ? "Files: " + files.map(f=>f.name).join(", ") : ""}

CRITICAL: Return ONLY a flat JSON object. Every value must be a plain string or number. No nested objects, no arrays, no null. Use empty string for not found.

Include "suggestedDocType" — one of: "assessment", "proposal", "project"
- "project" = capital project, equipment installation, one-time CapEx
- "proposal" = recurring O&M service contract, monthly fee
- "assessment" = site assessment, findings report, no pricing

Extract values for these keys: ${JSON.stringify([...allKeys, "suggestedDocType"])}

FIELD MAPPING:
- "sgContactName": default "Ted Winkelman" if not found
- "sgContactEmail": default "twinkelman@solutionmgt.com" if not found
- "dealAmount": any total dollar figure — most important field. Include $ and commas.
- "closeDate"/"proposalDate": any document date, format YYYY-MM-DD
- "clientLegalName"/"clientShortName": client/customer name
- "projectTitle": main project heading
- "executiveSummary": executive summary text (max 500 chars)
- "inScope": in-scope items as newline-separated string
- "managementCost": management/O&M/overhead cost from pricing table. Include $ and commas.
- "equipmentCost": equipment/parts/materials cost from pricing table. Include $ and commas.
- "laborCost": labor/installation cost from pricing table. Include $ and commas.
- "technologyCost": technology/software/monitoring cost from pricing table. Include $ and commas.
- "projectLengthDays": project duration in days (1 week = 7 days, 1 month = 30 days)
- "contractLengthDays": contract duration in days (1 month = 30 days, 1 year = 365 days)
- "customerContactName": primary customer/client contact person full name
- "customerContactEmail": primary customer/client contact email address`;

      msgContent.push({ type:"text", text: prompt });
      const raw = await callClaude(msgContent, 2500);

      let extracted = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("no json");
        extracted = JSON.parse(jsonMatch[0]);
      } catch(e) {
        const cleaned = raw.replace(/```json|```/g,'').trim();
        const m2 = cleaned.match(/\{[\s\S]*\}/);
        if (m2) extracted = JSON.parse(m2[0]);
        else throw new Error("Could not parse response — try again.");
      }

      setParseStep(2);
      const filled = new Set();
      const merged = {};
      Object.entries(extracted).forEach(([k,v]) => {
        // Never overwrite generatedBy or pipeline from parsed doc content
        if (k === 'generatedBy' || k === 'pipeline' || k === 'suggestedDocType') return;
        if (v && String(v).trim()) {
          merged[k] = String(v).trim();
          filled.add(k);
        }
      });

      const suggested = extracted.suggestedDocType || "project";
      const defaultPipeline = suggested === "project" ? "Project" : suggested === "proposal" ? "Recurring" : "";
      merged.pipeline = merged.pipeline || defaultPipeline;

      setFormData(merged);
      setAiKeys(filled);
      setDocType(suggested);
      setParsed(true);
      // Go to section builder for proposals and projects, skip it for assessments
      setPage(suggested === 'assessment' ? 'form' : 'sections');
    } catch(e) {
      setParseErr("Parse failed: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const setField = (key, val) => {
    setFormData(p=>({...p,[key]:val}));
    if (errors[key]) setErrors(p=>({...p,[key]:false}));
    if (key === 'generatedBy' && val.trim()) {
      localStorage.setItem("sg_generated_by", val.trim());
    }
  };

  const addFiles = (incoming) => {
    const ok = Array.from(incoming).filter(f=>
      ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
       "application/vnd.ms-excel",
       "text/plain","text/csv","application/csv",
       "image/png","image/jpeg"].includes(f.type)
      || f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    setFiles(p=>[...p,...ok].slice(0,5));
    setParsed(false);
  };

  const docFields = docType==="assessment" ? ASSESSMENT_FIELDS : docType==="proposal" ? PROPOSAL_FIELDS : docType==="project" ? PROJECT_PROPOSAL_FIELDS : OTHER_FIELDS;
  const allFields = [...PIPELINE_FIELDS, ...docFields];

  // ── completion percentage across ALL fields (required + optional) ──
  const totalFields = allFields.length;
  const filledAll   = allFields.filter(f => formData[f.key]?.toString().trim()).length;
  const completePct = totalFields > 0 ? Math.round((filledAll / totalFields) * 100) : 0;

  // required-only for gate
  const reqFields  = allFields.filter(f=>f.required);
  const filledReq  = reqFields.filter(f=>formData[f.key]?.toString().trim()).length;
  const reqPct     = reqFields.length > 0 ? Math.round((filledReq/reqFields.length)*100) : 0;

  // ── parse ──
  const handleParse = async () => {
    if (!files.length && !pastedText.trim()) { setParseErr("Add a file or paste text first."); return; }
    setParseErr(""); setParsing(true); setParseStep(0);
    try {
      const content = [];
      setParseStep(0);
      for (const f of files) {
        if (f.type==="application/pdf") {
          const b64 = await readFileAsBase64(f);
          content.push({ type:"document", source:{type:"base64",media_type:"application/pdf",data:b64} });
        } else if (f.type.startsWith("image/")) {
          const b64 = await readFileAsBase64(f);
          content.push({ type:"image", source:{type:"base64",media_type:f.type,data:b64} });
        } else if (f.name.endsWith(".docx") || f.type.includes("wordprocessingml")) {
          const text = await readDocxAsText(f);
          content.push({ type:"text", text:`[Document: ${f.name}]\n${text}` });
        } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.type.includes("spreadsheetml") || f.type.includes("ms-excel")) {
          const text = await readSpreadsheetAsText(f);
          content.push({ type:"text", text:`[Spreadsheet: ${f.name}]\n${text}` });
        } else if (f.name.endsWith(".csv") || f.type==="text/csv" || f.type==="application/csv" || f.type==="text/plain") {
          const text = await f.text();
          content.push({ type:"text", text:`[File: ${f.name}]\n${text}` });
        }
      }
      content.push({ type:"text", text:buildParsePrompt(docType, pastedText, files.map(f=>f.name)) });
      const raw = await callClaude(content, 2500);

      // Robust JSON extraction — handles markdown fences, extra text, and minor formatting issues
      let extracted = {};
      try {
        // First try: extract the outermost { } block
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("no json block");
        extracted = JSON.parse(jsonMatch[0]);
      } catch(parseErr) {
        // Second try: strip control characters and retry
        try {
          const cleaned = raw
            .replace(/```json|```/g, '')
            .replace(/[\x00-\x1F\x7F]/g, m => m === '\n' || m === '\r' || m === '\t' ? m : '')
            .trim();
          const jsonMatch2 = cleaned.match(/\{[\s\S]*\}/);
          if (!jsonMatch2) throw new Error("No JSON found in response — try again.");
          extracted = JSON.parse(jsonMatch2[0]);
        } catch(e2) {
          throw new Error("Could not parse response — try again or paste text manually.");
        }
      }
      setParseStep(2);
      const filled = new Set();
      const merged = {...formData};
      Object.entries(extracted).forEach(([k,v])=>{ if(k==='generatedBy'||k==='pipeline') return; if(v&&String(v).trim()){merged[k]=String(v).trim();filled.add(k);} });
      setFormData(merged); setAiKeys(filled); setParsed(true);
    } catch(e) {
      if (e.message === "CORS_BLOCKED") {
        setParseErr("Browser blocked the API call (CORS). This app must be deployed to a web server to call the Anthropic API — it cannot run from a local file or from inside Claude.ai. Deploy to Vercel or Netlify and it will work.");
      } else {
        setParseErr(`Parse failed: ${e.message}`);
      }
    }
    finally    { setParsing(false); }
  };

  // ── generate ──
  const validate = () => {
    const errs={};
    allFields.filter(f=>f.required && f.type !== "hidden").forEach(f=>{ if(!formData[f.key]?.toString().trim()) errs[f.key]=true; });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const missingLabels = allFields.filter(f => f.required && f.type !== "hidden" && errs[f.key]).map(f => f.label);
      const msg = missingLabels.length === 1
        ? `Please fill in the required field: ${missingLabels[0]}`
        : `Please fill in all required fields before generating:\n• ${missingLabels.join('\n• ')}`;
      setGenErr(msg);
      // Scroll to first error field
      const firstKey = allFields.find(f => f.required && f.type !== "hidden" && errs[f.key])?.key;
      if (firstKey) {
        const el = document.querySelector(`[data-field="${firstKey}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    return true;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setGenErr(""); setGenerating(true); setGenStep(0); setHubspotStatus(null);
    try {
      const content = [];
      setGenStep(0);
      // Extract text content from files to send to the server
      const fileContents = [];
      for (const f of files) {
        if (f.name.endsWith(".docx") || f.type.includes("wordprocessingml")) {
          const text = await readDocxAsText(f);
          fileContents.push(`[Document: ${f.name}]\n${text}`);
        } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.type.includes("spreadsheetml") || f.type.includes("ms-excel")) {
          const text = await readSpreadsheetAsText(f);
          fileContents.push(`[Spreadsheet: ${f.name}]\n${text}`);
        } else if (f.name.endsWith(".csv") || f.type==="text/csv" || f.type==="text/plain") {
          const text = await f.text();
          fileContents.push(`[File: ${f.name}]\n${text}`);
        }
      }
      setGenStep(1);
      // Always do a full regeneration — use stored file contents on revision so
      // original context is preserved. Accumulate all instructions over time.
      const isRevision = lastConfig !== null && revisionCount > 0;
      const effectiveFileContents = isRevision ? lastFileContents : fileContents;

      // Store file contents after first extraction so revisions can reuse them
      if (!isRevision && fileContents.length > 0) {
        setLastFileContents(fileContents);
      }

      // Build accumulated instructions — stack new instructions on top of previous ones
      const newInstructions = formData.additionalInstructions || "";
      const revisionsText = isRevision && revisionCount > 0
        ? [accumulatedInstructions, newInstructions].filter(Boolean).join("\n\nAdditionally: ")
        : newInstructions;

      if (newInstructions && !newInstructions.startsWith("REVISION REQUEST")) {
        setAccumulatedInstructions(revisionsText);
      }

      // Build effective formData with accumulated instructions
      const effectiveFormData = {
        ...formData,
        additionalInstructions: revisionsText,
      };

      const resp = await fetch("/api/generate-document", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          docType,
          formData: effectiveFormData,
          pastedText,
          fileContents: effectiveFileContents,
          optionalSections: formData.optionalSections || [],
          sectionOrder: formData.sectionOrder || null,
        }),
      });
      setGenStep(2);
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}));
        throw new Error(err?.error || `Server error ${resp.status}`);
      }
      // Store the config that was used to generate this document
      const configHeader = resp.headers.get('X-Document-Config');
      if (configHeader) {
        try { setLastConfig(JSON.parse(atob(configHeader))); } catch(e) {}
      }
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      // Filename: {Company} {Location} {3-word description} - {M.DD}
      const now = new Date();
      const dateShort = `${now.getMonth()+1}.${String(now.getDate()).padStart(2,'0')}`;
      const companyName = (formData.clientShortName || formData.clientLegalName || formData.clientName || "Client").trim();
      const companyWords = new Set(companyName.toLowerCase().split(/\s+/));
      const projectDesc = (formData.projectTitle || formData.serviceDescription || "")
        .replace(/[-–—]/g, ' ')          // remove dashes/em dashes
        .replace(/[^a-zA-Z0-9\s]/g, '')  // remove special chars
        .split(/\s+/).filter(Boolean)
        .filter(w => !companyWords.has(w.toLowerCase()))   // titles often repeat the client name
        .slice(0, 3).join(' ');          // max 3 words
      const filename = `${companyName}${projectDesc ? ' ' + projectDesc : ''} - ${dateShort}.docx`;
      setGenStep(3);
      a.href=dlUrl; a.download=filename; a.click();
      URL.revokeObjectURL(dlUrl);
      setGenerating(false);
      setGenerated(true);

      // Fire HubSpot deal creation/update silently in background
      if (docType !== "assessment" && !skipHubspot) {
        setHubspotStatus({ state:"working", text:"Saving deal and attaching document in HubSpot…" });
        fetch("/api/hubspot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType,
            clientName:           formData.clientLegalName || formData.clientName,
            clientShortName:      formData.clientShortName,
            projectTitle:         formData.projectTitle,
            pipeline:             formData.pipeline,
            dealAmount:           formData.dealAmount,
            closeDate:            formData.closeDate,
            closeProbability:     formData.closeProbability,
            sgContactName:        formData.sgContactName,
            sgContactEmail:       formData.sgContactEmail,
            customerContactName:  formData.customerContactName,
            customerContactEmail: formData.customerContactEmail,
            managementCost:       formData.managementCost,
            equipmentCost:        formData.equipmentCost,
            laborCost:            formData.laborCost,
            technologyCost:       formData.technologyCost,
            projectLengthDays:    formData.projectLengthDays,
            contractLengthDays:   formData.contractLengthDays,
            existingDealId:       lastDealId,
            generatedBy:          formData.generatedBy,
            dealSource:           formData.dealSource,
          }),
        }).then(r => r.json()).then(data => {
          if (data?.dealId) {
            setLastDealId(data.dealId);
            console.log(`✓ HubSpot deal ${data.isNew ? 'created' : 'updated'}: ${data.dealName} (${data.dealId})`);
            // Upload the .docx and attach it to the deal as a note
            blobToBase64(blob)
              .then(docBase64 => fetch("/api/hubspot-attach", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dealId: data.dealId, filename, docBase64 }),
              }))
              .then(r => r.json().then(j => ({ ok: r.ok, j })))
              .then(({ ok, j }) => {
                if (!ok) throw new Error(j?.error || "Attachment failed");
                console.log(`✓ Document attached to deal ${data.dealId} (file ${j.fileId})`);
                setHubspotStatus({ state:"done", text:`Document attached to HubSpot deal "${data.dealName}"` });
              })
              .catch(e => {
                console.warn('HubSpot attach failed:', e.message);
                setHubspotStatus({ state:"error", text:`Deal ${data.isNew ? 'created' : 'updated'}, but the document could not be attached: ${e.message}` });
              });
          } else {
            console.warn('HubSpot: no dealId', data);
            setHubspotStatus({ state:"error", text:`HubSpot deal not saved: ${data?.error || 'no deal ID returned'}` });
          }
          // Schedule approval email — fires 10 min after last generation
          scheduleEmail({
            docType,
            clientName:          formData.clientLegalName || formData.clientName,
            dealAmount:          formData.dealAmount,
            pipeline:            formData.pipeline,
            sgContactName:       formData.sgContactName,
            customerContactName: formData.customerContactName,
            closeDate:           formData.closeDate,
            generatedBy:         formData.generatedBy,
            dealId:              data?.dealId,
          });
        }).catch(e => {
          console.warn('HubSpot call failed:', e.message);
          setHubspotStatus({ state:"error", text:`HubSpot deal not saved: ${e.message}` });
          // Still schedule email even if HubSpot fails
          scheduleEmail({
            docType,
            clientName:          formData.clientLegalName || formData.clientName,
            dealAmount:          formData.dealAmount,
            pipeline:            formData.pipeline,
            sgContactName:       formData.sgContactName,
            customerContactName: formData.customerContactName,
            closeDate:           formData.closeDate,
          });
        });
      }
    } catch(e) {
      setGenerating(false);
      setGenErr(`Generation failed: ${e.message}`);
    }
  };

  const renderField = (f) => {
    if (f.type === "hidden") return null;
    const isAI = aiKeys.has(f.key);
    const cls  = errors[f.key] ? "err" : isAI ? "ai-filled" : "";
    return (
      <div key={f.key} className="field" data-field={f.key} style={f.full?{gridColumn:"1 / -1"}:{}}>
        <label>
          {f.label}
          {f.required ? <span className="req"> *</span> : <span className="opt"> optional</span>}
          {isAI && <span className="ai-badge">auto-filled</span>}
        </label>
        {f.type==="textarea" ? (
          <textarea className={cls} placeholder={f.placeholder} value={formData[f.key]||""} onChange={e=>setField(f.key,e.target.value)} />
        ) : f.type==="select" ? (
          <select className={cls} value={formData[f.key]||""} onChange={e=>setField(f.key,e.target.value)}>
            {f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={f.type||"text"} className={cls} placeholder={f.placeholder} value={formData[f.key]||""} onChange={e=>setField(f.key,e.target.value)} />
        )}
        {f.help && <div style={{fontSize:11,color:"#9aa5b4",marginTop:3,fontStyle:"italic"}}>{f.help}</div>}
      </div>
    );
  };

  return (
    <>
      <style>{styles}</style>

      <header className="header">
        <div className="header-logo-wrap">
          <img src={SG_LOGO} alt="Solution Group" className="header-logo-img" />
        </div>
        <div className="header-divider" />
        <div className="header-text">
          <div className="header-title">Document Generator</div>
          <div className="header-sub">Solution Group · Internal Tool</div>
        </div>
        <div className="header-right">
          <span>solutionmgt.com</span>
          <button className="help-btn" onClick={()=>setShowHelp(true)}>? Need help</button>
        </div>
      </header>

      {/* ── HELP MODAL ── */}
      {showHelp && (
        <div className="help-overlay" onClick={()=>setShowHelp(false)}>
          <div className="help-modal" onClick={e=>e.stopPropagation()}>
            <div className="help-header">
              <h2>How it works</h2>
              <button onClick={()=>setShowHelp(false)}>×</button>
            </div>
            <div className="help-body">
              <div className="help-steps">

                <div className="help-step">
                  <div className="help-step-num">1</div>
                  <div className="help-step-content">
                    <h3>Choose your document type</h3>
                    <p>Pick from the four options on the home screen based on what you need to produce. Not sure? If you're following up on a site visit, choose Assessment. If you're proposing ongoing services, choose Recurring Proposal. If it's a capital project with equipment and installation, choose Project Proposal.</p>
                    <div className="help-types">
                      <div className="help-type"><h4>🔍 Assessment</h4><p>Site findings and recommendations. No pricing included.</p></div>
                      <div className="help-type"><h4>📄 Recurring Proposal</h4><p>Monthly O&M service contract with pricing.</p></div>
                      <div className="help-type"><h4>🏗️ Project Proposal</h4><p>Capital project with scope, schedule, and itemized pricing.</p></div>
                      <div className="help-type"><h4>✏️ Custom</h4><p>Anything else — freeform, no required fields.</p></div>
                    </div>
                  </div>
                </div>

                <div className="help-step">
                  <div className="help-step-num">2</div>
                  <div className="help-step-content">
                    <h3>Upload your files or paste notes</h3>
                    <p>Drop in any relevant documents — an existing proposal, project tracker, spreadsheet, email thread, or site visit notes. You can upload multiple files at once. The more context you provide, the better the output.</p>
                    <div className="tip">💡 Even a rough draft or a pasted email thread is enough to get started. Claude will figure out what's relevant.</div>
                  </div>
                </div>

                <div className="help-step">
                  <div className="help-step-num">3</div>
                  <div className="help-step-content">
                    <h3>Click "Parse & Build Proposal Form"</h3>
                    <p>Claude reads everything you uploaded and automatically fills in the form fields — client name, deal amount, contact info, project details, and more. Review the pre-filled fields and correct anything that looks off. Required fields are marked with a red asterisk.</p>
                    <div className="tip">💡 If a field didn't auto-fill, just type it in manually. The more fields you complete, the richer the document.</div>
                  </div>
                </div>

                <div className="help-step">
                  <div className="help-step-num">4</div>
                  <div className="help-step-content">
                    <h3>Generate & Download</h3>
                    <p>Hit the Generate & Download button at the bottom. Claude writes the full document and it downloads to your device as a branded Word file. A deal is automatically created in HubSpot with the relevant fields populated, and the Word file is attached to it.</p>
                    <div className="tip">💡 Not happy with the output? Use the revision box that appears after download to make targeted changes — "shorten the engineering scope" or "update the total to $380,000". For bigger changes, hit Start Over.</div>
                  </div>
                </div>

              </div>

              <hr className="help-divider" />
              <p style={{fontSize:12,color:"#9aa5b4",textAlign:"center"}}>Questions or feedback? Reach out to Chase Cochran.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HOME ── */}
      {page==="home" && (
        <div className="home">
          <h1>Generate<br />a Document</h1>
          <p>Build a branded assessment or proposal in minutes. Upload your files and let Claude do the writing.</p>
          <div className="doc-cards">
            {DOC_TYPES.map(dt=>(
              <div key={dt.id} className="doc-card" onClick={()=>startIntake(dt.id)}>
                <div className="icon">{dt.icon}</div>
                <h3>{dt.title}</h3>
                <p>{dt.desc}</p>
                <span className={`badge ${dt.badgeClass}`}>{dt.badge}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INTAKE ── */}
      {page==="intake" && (
        <div className="intake-page">
          <div className="intake-title">Let's get started</div>
          <div className="intake-sub">Upload your files and add any relevant context. Claude will read everything and pre-fill the proposal form for you.</div>

          <div className="intake-grid">
            {/* Upload card */}
            <div className="intake-card">
              <div style={{fontSize:32}}>📎</div>
              <h3>Upload Files</h3>
              <p>Proposals, project trackers, spreadsheets, PDFs, or any relevant documents</p>
              <div
                className={`intake-upload-zone${dragOver?" drag":""}`}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files);}}
                onClick={()=>fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg"
                  onChange={e=>addFiles(e.target.files)} style={{display:"none"}} />
                <div className="intake-upload-icon">⬆</div>
                <h4>Drop files or click to upload</h4>
                <p>PDF, DOCX, XLSX, CSV, images</p>
              </div>
              {files.length > 0 && (
                <div className="intake-files" style={{width:"100%"}}>
                  {files.map((f,i)=>(
                    <div key={i} className="intake-file">
                      📄 <span className="fname" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"200px",display:"inline-block"}}>{f.name}</span>
                      <span style={{fontSize:11,color:"#9aa5b4"}}>{(f.size/1024).toFixed(0)}KB</span>
                      <button onClick={e=>{e.stopPropagation();setFiles(p=>p.filter((_,j)=>j!==i));}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paste card */}
            <div className="intake-card">
              <div style={{fontSize:32}}>📋</div>
              <h3>Add Context</h3>
              <p>Paste email threads, call notes, discovery summaries, or any text that provides background</p>
              <textarea
                className="intake-paste"
                placeholder={"Paste anything here that would help — email threads, call notes, site visit observations, client requirements, copy-pasted text from another document..."}
                value={pastedText}
                onChange={e=>setPastedText(e.target.value)}
              />
            </div>
          </div>

          {parseErr && <div className="err-banner" style={{marginBottom:12}}><span>⚠</span><span>{parseErr}</span></div>}

          <button
            className="btn-parse-big"
            onClick={handleIntakeParse}
            disabled={(!files.length && !pastedText.trim()) || parsing}
          >
            {parsing ? "⏳ Reading your files..." : "✦ Parse & Build Proposal Form"}
          </button>
          <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"#b0bbc8"}}>
            Claude will read your files, extract the relevant details, and open the proposal form pre-filled
          </div>
          <button className="form-back" style={{margin:"20px auto 0",display:"block"}} onClick={()=>setPage("home")}>← Back</button>
        </div>
      )}

      {/* ── SECTIONS ── */}
      {page==="sections" && docType && (() => {
        const ALL_SECTIONS = [
          { key:"introduction",        label:"Proposal Introduction",        desc:"Opening statement and context",                  optional:false },
          { key:"project_confirmation",label:"Project Confirmation",         desc:"Scope reference and commercial framing",         optional:false, docTypes:["project"] },
          { key:"service_confirmation",label:"Service Confirmation",         desc:"What Solution Group will deliver",               optional:false, docTypes:["proposal"] },
          { key:"engineering_scope",   label:"Engineering Scope Summary",    desc:"Technical system narrative",                    optional:false, docTypes:["project"] },
          { key:"commercial_summary",  label:"Commercial Summary",           desc:"Pricing table and investment totals",            optional:false },
          { key:"timeline",            label:"Project Timeline",             desc:"Schedule phases (only if data provided)",        optional:false },
          { key:"assumptions",         label:"Key Assumptions & Exclusions", desc:"Contract assumptions and scope boundaries",      optional:false },
          { key:"next_steps",          label:"Next Steps",                   desc:"Action items and path to execution",             optional:false },
          { key:"opticlear",           label:"OptiClear Remote Monitoring",  desc:"Platform features and dashboard capabilities",   optional:true },
          { key:"safety",              label:"Operational Safety Support",   desc:"Auditing, training, near-miss, 5S program",      optional:true },
          { key:"sg_academy",          label:"Solution Group Academy",       desc:"Operator training and certification programs",   optional:true },
          { key:"kpi_reporting",       label:"KPI Reporting & Dashboard",    desc:"Executive dashboard and reporting cadence",      optional:true },
        ].filter(s => !s.docTypes || s.docTypes.includes(docType));

        const sectionState = formData.sectionBuilderState || ALL_SECTIONS.map(s => ({ ...s, checked: !s.optional }));

        sectionStateRef.current = sectionState;

        const updateSections = (newState) => setFormData(prev => ({ ...prev, sectionBuilderState: newState }));
        const toggleSection = (key) => updateSections(sectionStateRef.current.map(s => s.key === key ? { ...s, checked: !s.checked } : s));

        const moveSection = (idx, dir) => {
          const arr = [...sectionStateRef.current];
          const target = idx + dir;
          if (target < 0 || target >= arr.length) return;
          [arr[idx], arr[target]] = [arr[target], arr[idx]];
          updateSections(arr);
        };

        const handleContinue = () => {
          const checkedKeys = sectionState.filter(s => s.checked).map(s => s.key);
          const optionalSelected = checkedKeys.filter(k => ALL_SECTIONS.find(s => s.key === k && s.optional));
          setFormData(prev => ({ ...prev, optionalSections: optionalSelected, sectionOrder: checkedKeys, sectionBuilderState: sectionState }));
          setPage("form");
        };

        const checkedCount = sectionState.filter(s => s.checked).length;

        return (
          <div className="sections-page">
            <button className="form-back" onClick={()=>setPage("intake")}>← Back</button>
            <div className="sections-title">Build your document</div>
            <div className="sections-sub">
              Check the sections to include. Hover any row to reorder with the arrows.
            </div>

            <div className="section-list">
              {sectionState.map((s, idx) => (
                <div
                  key={s.key}
                  className={`section-row${s.checked ? " checked" : ""}${s.optional ? " optional" : ""}`}
                  style={{position:"relative"}}
                >
                  <div className={`section-checkbox${s.checked ? " checked" : ""}`} onClick={()=>toggleSection(s.key)}>
                    {s.checked && <span style={{color:"white",fontSize:12,lineHeight:1,fontWeight:700}}>✓</span>}
                  </div>
                  <div className="section-label">
                    <div className="section-label-name">{s.label}</div>
                    <div className="section-label-desc">{s.desc}</div>
                  </div>
                  <span className={`section-badge ${s.optional ? "section-badge-optional" : "section-badge-default"}`}>
                    {s.optional ? "optional" : "default"}
                  </span>
                  <div className="section-arrows">
                    <button
                      className="arrow-btn"
                      onClick={()=>moveSection(idx,-1)}
                      disabled={idx===0}
                      title="Move up"
                    >▲</button>
                    <button
                      className="arrow-btn"
                      onClick={()=>moveSection(idx,1)}
                      disabled={idx===sectionState.length-1}
                      title="Move down"
                    >▼</button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-continue" onClick={handleContinue} disabled={checkedCount === 0}>
              Continue to Deal Details →
            </button>
            <div style={{textAlign:"center",marginTop:10,fontSize:12,color:"#b0bbc8"}}>
              {checkedCount} section{checkedCount !== 1 ? "s" : ""} selected
            </div>
          </div>
        );
      })()}

      {/* ── CUSTOM ── */}
      {page==="custom" && (
        <div className="custom-page">
          <button className="form-back" onClick={()=>setPage("home")}>← Back</button>
          <div className="custom-title">Custom Document</div>
          <div className="custom-sub">
            Describe exactly what you need — no predefined structure, no required fields.
            Upload any relevant files and tell Claude what to produce.
          </div>

          <div className="custom-examples">
            <p>Examples — click to use</p>
            <ul>
              {[
                "Rewrite the executive summary of the attached proposal to be more concise — no more than 2 short paragraphs",
                "Write a one-page follow-up letter to the client referencing the attached proposal and confirming next steps",
                "Pull the key pricing from the attached documents and create a simple comparison table",
                "Draft a brief project update memo summarizing where we are and what's left to complete",
                "Summarize the attached site assessment into a 5-bullet executive briefing for leadership",
              ].map((ex,i) => (
                <li key={i} onClick={()=>setCustomPrompt(ex)}>"{ex}"</li>
              ))}
            </ul>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:6,letterSpacing:"0.2px"}}>
              What do you need? <span style={{color:"#e24b4a"}}>*</span>
            </div>
            <textarea
              className="custom-prompt"
              placeholder={"Describe what you need — be as specific as possible.\n\nExamples:\n• 'Rewrite the executive summary to be 2 sentences'\n• 'Pull all pricing from the attached docs into one table'\n• 'Write a follow-up email referencing the Agropur proposal'"}
              value={customPrompt}
              onChange={e=>{setCustomPrompt(e.target.value);setCustomErr("");}}
            />
          </div>

          {/* File upload */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#4a5568",marginBottom:6,letterSpacing:"0.2px"}}>Attach files <span style={{color:"#9aa5b4",fontWeight:400}}>(optional)</span></div>
            <div
              style={{border:"2px dashed #c8d4e8",borderRadius:8,padding:"18px 24px",textAlign:"center",cursor:"pointer",background:"#fafbfc",transition:"all 0.18s"}}
              onDragOver={e=>{e.preventDefault();}}
              onDrop={e=>{e.preventDefault();setCustomFiles(p=>[...p,...Array.from(e.dataTransfer.files)].slice(0,5));}}
              onClick={()=>document.getElementById('custom-file-input').click()}
            >
              <input id="custom-file-input" type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg" style={{display:"none"}} onChange={e=>setCustomFiles(p=>[...p,...Array.from(e.target.files)].slice(0,5))} />
              <div style={{fontSize:24,marginBottom:6}}>📎</div>
              <div style={{fontSize:13,color:"#7a8a9a"}}>Drop files or click to upload — PDF, DOCX, XLSX, CSV, images</div>
            </div>
            {customFiles.length > 0 && (
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
                {customFiles.map((f,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:SG_LIGHT,borderRadius:4,padding:"6px 10px",fontSize:13,color:SG_BLUE}}>
                    📄 <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                    <button onClick={()=>setCustomFiles(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#9aa5b4",cursor:"pointer",fontSize:16}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {customErr && <div className="err-banner" style={{marginBottom:12}}><span>⚠</span><span>{customErr}</span></div>}

          <button
            className="btn-parse-big"
            onClick={handleCustomGenerate}
            disabled={(!customPrompt.trim() && !customFiles.length) || customGenerating}
          >
            {customGenerating ? "⏳ Generating…" : "⬇ Generate & Download"}
          </button>
          <div style={{textAlign:"center",marginTop:10,fontSize:12,color:"#b0bbc8"}}>
            No HubSpot deal is created for custom documents
          </div>
        </div>
      )}

      {/* ── FORM ── */}
      {page==="form" && (
        <div className="form-outer">
          <WaterBar pct={completePct} />

          <div className="form-main">
            <button className="form-back" onClick={()=>setPage("intake")}>← Back</button>
            <div className="form-title">
              {docType==="assessment"?"Assessment":docType==="proposal"?"Recurring Proposal":docType==="project"?"Project Proposal":"Document"}
            </div>
            <div className="form-subtitle">
              {aiKeys.size > 0
                ? `${aiKeys.size} fields pre-filled from your files — review, adjust, and generate.`
                : "Fill in the details below and generate your document."}
            </div>

            {/* Doc type selector — lets user correct if Claude guessed wrong */}
            <div className="section" style={{padding:"16px 28px"}}>
              <div className="section-title" style={{marginBottom:12}}>Document Type</div>
              <div style={{display:"flex",gap:10}}>
                {DOC_TYPES.map(dt=>(
                  <button key={dt.id} onClick={()=>selectDoc(dt.id)} style={{
                    flex:1, padding:"10px 8px", border:`2px solid ${docType===dt.id ? SG_BLUE : SG_BORDER_GRAY}`,
                    borderRadius:6, background: docType===dt.id ? SG_BLUE : "white",
                    color: docType===dt.id ? "white" : "#333", cursor:"pointer",
                    fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
                    transition:"all 0.15s"
                  }}>
                    {dt.icon} {dt.title}
                  </button>
                ))}
              </div>
            </div>

            {/* DEAL INFO */}
            <div className="section">
              <div className="section-title">Deal Information</div>
              <div className="field-grid">
                {PIPELINE_FIELDS.slice(0,4).map(renderField)}
              </div>
              <div className="field-grid" style={{marginTop:12}}>
                {PIPELINE_FIELDS.slice(4).map(renderField)}
              </div>

              {/* Calculated end date — shown based on pipeline type */}
              {(() => {
                const isProject  = formData.pipeline === "Project";
                const isRecurring = formData.pipeline === "Recurring";
                const lengthDays = isProject ? formData.projectLengthDays : isRecurring ? formData.contractLengthDays : null;
                const endDate    = calculateEndDate(formData.closeDate, lengthDays);
                const label      = isProject ? "Estimated Project End Date" : "Estimated Contract End Date";
                if (!endDate) return null;
                return (
                  <div style={{marginTop:12, padding:"10px 14px", background:"#f0f5ff", borderRadius:6, border:`1px solid ${SG_BLUE}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                    <span style={{fontSize:12, fontWeight:600, color:SG_BLUE}}>{label}</span>
                    <span style={{fontSize:13, fontWeight:500, color:"#333"}}>{new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</span>
                  </div>
                );
              })()}
            </div>

            {/* DOC DETAILS */}
            <div className="section">
              <div className="section-title">
                {docType==="assessment"?"Assessment Details":docType==="proposal"?"Proposal Details":docType==="project"?"Project Details":"Document Details"}
                {parsed && aiKeys.size>0 && <span className="pill green">Auto-filled</span>}
              </div>
              <div className="field-grid">
                {docFields.filter(f=>!f.full&&f.type!=="textarea").map(renderField)}
              </div>
              {docFields.filter(f=>f.full||f.type==="textarea").map(f=>(
                <div key={f.key} style={{marginTop:12}}>{renderField(f)}</div>
              ))}
            </div>

            {/* GENERATE */}
            <div className="gen-bar">
              <div className="gen-info">
                <div><strong>{filledReq} of {reqFields.length}</strong> required fields complete</div>
                <div style={{fontSize:12,color:"#9aa5b4",marginTop:2}}>
                  {filledAll} of {totalFields} total fields filled · more detail = better document
                </div>
                {reqPct===100 && <div style={{fontSize:12,color:"#1D9E75",marginTop:2}}>✓ Ready to generate</div>}
                {genErr && (
                  <div style={{fontSize:12,color:"#991b1b",marginTop:6,fontWeight:500,whiteSpace:"pre-line",lineHeight:1.5}}>
                    ⚠ {genErr}
                  </div>
                )}
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                  <button
                    onClick={()=>setSkipHubspot(p=>!p)}
                    style={{
                      background: skipHubspot ? "#fff3f3" : "transparent",
                      border: `1px solid ${skipHubspot ? "#e24b4a" : "#e2e8f0"}`,
                      borderRadius:4, padding:"3px 10px", fontSize:11,
                      color: skipHubspot ? "#991b1b" : "#9aa5b4",
                      cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                      fontWeight: skipHubspot ? 600 : 400,
                      transition:"all 0.15s",
                    }}
                  >
                    {skipHubspot ? "⊘ HubSpot push disabled" : "Skip HubSpot push"}
                  </button>
                  {skipHubspot && <span style={{fontSize:11,color:"#9aa5b4"}}>for testing — deal won't be created</span>}
                </div>
              </div>
              <button className="btn-gen" onClick={handleGenerate} disabled={generating}>
                ⬇ Generate & Download
              </button>
              {hubspotStatus && (
                <div style={{
                  marginTop:10, fontSize:12, lineHeight:1.5,
                  color: hubspotStatus.state === "error" ? "#991b1b" : hubspotStatus.state === "done" ? "#166534" : "#5a6577",
                }}>
                  {hubspotStatus.state === "done" ? "✓ " : hubspotStatus.state === "error" ? "⚠ " : ""}{hubspotStatus.text}
                </div>
              )}
            </div>

            {/* REVISION BOX — shown after successful download */}
            {generated && (
              <div className="revision-box">
                <h4>Need to make some changes?</h4>
                <p>
                  Describe what you want changed. This triggers a full regeneration using all your original files plus everything you've specified so far — the more detail the better.
                  {revisionCount > 0 && <span style={{color:"#9aa5b4"}}> ({revisionCount} revision{revisionCount > 1 ? "s" : ""} made)</span>}
                </p>

                {revisionCount >= 2 && (
                  <div style={{background:"#f0f5ff",border:"1px solid #c8d4e8",borderRadius:6,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#2B579A",lineHeight:1.6}}>
                    <strong>Note:</strong> Each regeneration builds on all previous instructions. If the document is moving in the wrong direction entirely, use Start Over to reset.
                  </div>
                )}

                <textarea
                  placeholder="e.g. 'Update the total to $380,000', 'Add a signature block', 'Shorten the engineering scope to 2 sentences', 'Change the close date to September 1st'..."
                  value={revisions}
                  onChange={e=>setRevisions(e.target.value)}
                />
                <div className="revision-actions">
                  {/* Start from scratch — always visible */}
                  <button
                    className="btn-revise"
                    style={{background:"white",color:"#7a8a9a",border:"1px solid #e2e8f0",fontSize:12}}
                    disabled={generating}
                    onClick={() => {
                      setGenerated(false);
                      setRevisions("");
                      setLastConfig(null);
                      setLastFileContents([]);
                      setAccumulatedInstructions("");
                      setRevisionCount(0);
                      setGenErr("");
                      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ↺ Start Over with Fresh Generation
                  </button>

                  <button
                    className="btn-revise"
                    disabled={!revisions.trim() || generating}
                    onClick={() => {
                      const revisionText = revisions.trim();
                      const todayStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
                      // Stack new instructions on accumulated context
                      const newInstructions = accumulatedInstructions
                        ? accumulatedInstructions + "\n\nAdditional revision: " + revisionText + " (Today's date: " + todayStr + ")"
                        : revisionText + " (Today's date: " + todayStr + ")";
                      setAccumulatedInstructions(newInstructions);
                      setFormData(prev => ({ ...prev, additionalInstructions: newInstructions }));
                      setRevisions("");
                      setGenerated(false);
                      setRevisionCount(prev => prev + 1);
                      // Small delay to let state commit then call handleGenerate
                      setTimeout(() => handleGenerate(), 50);
                    }}
                  >
                    ↻ Regenerate with Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {parsing && (
        <div className="overlay">
          <div className="overlay-card">
            <img src={SG_LOGO} alt="Solution Group" className="overlay-logo" />
            <div className="spinner" />
            <h3>Reading your files…</h3>
            <p>Claude is extracting relevant data to pre-fill the form.</p>
            <div className="steps">
              {PARSE_STEPS.map((s,i)=>(
                <div key={i} className={`step ${i<parseStep?"done":i===parseStep?"active":""}`}>
                  <div className={`dot ${i<parseStep?"done":i===parseStep?"active":""}`} />{s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {generating && (
        <div className="overlay">
          <div className="overlay-card">
            <img src={SG_LOGO} alt="Solution Group" className="overlay-logo" />
            <div className="spinner" />
            <h3>Generating document…</h3>
            <p>Claude is writing your {docType==="assessment"?"assessment":docType==="proposal"?"recurring proposal":docType==="project"?"project proposal":"document"}.</p>
            <div className="steps">
              {GEN_STEPS.map((s,i)=>(
                <div key={i} className={`step ${i<genStep?"done":i===genStep?"active":""}`}>
                  <div className={`dot ${i<genStep?"done":i===genStep?"active":""}`} />{s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>6239 S. East Street, Suite F, Indianapolis, IN 46227 · (800) 465-8200 · solutionmgt.com</span>
        <span>© {new Date().getFullYear()} Environmental Management Solutions, Inc. d/b/a Solution Group</span>
      </footer>
    </>
  );
}
