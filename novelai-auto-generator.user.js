// ==UserScript==
// @name         NovelAI Auto Generator Console
// @namespace    https://github.com/dhl02190219-cell/NAI-Auto
// @version      2.0.0
// @description  NovelAI 자동 생성 콘솔 (상태 자동 인식, 드래그 & 최소화 지원)
// @author       dhl02190219-cell
// @match        https://novelai.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=novelai.net
// @grant        none
// @updateURL    https://raw.githubusercontent.com/dhl02190219-cell/NAI-Auto/main/novelai-auto-generator.user.js
// @downloadURL  https://raw.githubusercontent.com/dhl02190219-cell/NAI-Auto/main/novelai-auto-generator.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === 상태 관리 ===
    let isRunning = false;
    let loopCount = 0;
    let timer = null;
    let isMinimized = false;

    // === UI 전체 패널 ===
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.top = '10px';
    panel.style.right = '10px';
    panel.style.zIndex = '99999';
    panel.style.backgroundColor = '#1e1e24';
    panel.style.color = '#fff';
    panel.style.borderRadius = '8px';
    panel.style.border = '1px solid #4a4a50';
    panel.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    panel.style.fontFamily = 'sans-serif';
    panel.style.fontSize = '14px';
    panel.style.width = '220px';
    panel.style.overflow = 'hidden';

    // === 상단바 (드래그 핸들 & 최소화 버튼) ===
    const header = document.createElement('div');
    header.style.padding = '8px 10px';
    header.style.backgroundColor = '#2d2d35';
    header.style.borderBottom = '1px solid #4a4a50';
    header.style.cursor = 'move';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.userSelect = 'none';

    header.innerHTML = `
        <span style="font-weight: bold; color: #fce7cf; font-size: 13px;">NAI Auto</span>
        <span id="nai-min-btn" style="cursor: pointer; padding: 0 5px; font-size: 12px;">▼</span>
    `;

    // === 내용물 (컨트롤러) ===
    const content = document.createElement('div');
    content.id = 'nai-content';
    content.style.padding = '15px';
    content.style.display = 'block';

    content.innerHTML = `
        <div style="margin-bottom: 12px;">
            <label>반복 횟수 (회):</label>
            <input type="number" id="nai-loop-count" value="10" min="1" style="width: 100%; box-sizing: border-box; background: #333; border: 1px solid #555; color: white; padding: 4px; margin-top: 4px;">
        </div>

        <div style="margin-bottom: 12px; font-size: 11px; color: #aaa; text-align: center;">
            스마트 감지 모드 (대기시간 불필요)
        </div>

        <div style="display: flex; gap: 5px;">
            <button id="nai-start-btn" style="flex: 1; padding: 8px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">시작</button>
            <button id="nai-stop-btn" style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">중지</button>
        </div>

        <div id="nai-status" style="margin-top: 10px; text-align: center; color: #ffd700; font-size: 12px;">대기 중...</div>
    `;

    // 패널 조립
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    // === 기능: 드래그 앤 드롭 ===
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let hasMoved = false;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasMoved = false;

        const rect = panel.getBoundingClientRect();
        panel.style.right = 'auto';
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;

        panel.style.left = `${initialLeft + dx}px`;
        panel.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // === 기능: 최소화 (상단바 클릭) ===
    header.addEventListener('click', () => {
        if (hasMoved) return; // 드래그 시 작동 방지

        isMinimized = !isMinimized;
        const btn = document.getElementById('nai-min-btn');

        if (isMinimized) {
            content.style.display = 'none';
            panel.style.width = '120px';
            btn.innerText = '▲';
        } else {
            content.style.display = 'block';
            panel.style.width = '220px';
            btn.innerText = '▼';
        }
    });

    // === 로직: 자동 감지 ===
    function findActiveGenerateButton() {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        return buttons.find(b => 
            (b.innerText.includes('Generate') || b.innerText.includes('Send')) && 
            !b.disabled && 
            b.getAttribute('aria-disabled') !== 'true'
        );
    }

    const statusDiv = document.getElementById('nai-status');
    const startBtn = document.getElementById('nai-start-btn');
    const stopBtn = document.getElementById('nai-stop-btn');

    function updateStatus(msg) {
        statusDiv.innerText = msg;
    }

    function autoClickLoop() {
        if (!isRunning) return;

        if (loopCount <= 0) {
            isRunning = false;
            updateStatus("완료되었습니다.");
            return;
        }

        const btn = findActiveGenerateButton();

        if (btn) {
            // 버튼이 활성화 상태일 때 클릭
            btn.click();
            loopCount--;
            document.getElementById('nai-loop-count').value = loopCount;
            
            updateStatus(`생성 중... (남은 횟수: ${loopCount})`);

            // 클릭 직후 버튼 상태 변경 대기 (1.5초)
            timer = setTimeout(autoClickLoop, 1500);
        } else {
            // 버튼이 비활성화(생성 중) 상태일 때 감지하며 대기 (1초 간격)
            updateStatus(`생성 완료 대기 중... (${loopCount}회 남음)`);
            timer = setTimeout(autoClickLoop, 1000);
        }
    }

    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (isRunning) return;

        loopCount = parseInt(document.getElementById('nai-loop-count').value, 10);
        if (isNaN(loopCount) || loopCount <= 0) {
            updateStatus("올바른 반복 횟수를 입력하세요.");
            return;
        }

        isRunning = true;
        updateStatus("자동 생성 시작...");
        autoClickLoop();
    });

    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isRunning = false;
        if (timer) clearTimeout(timer);
        updateStatus("중지됨.");
    });

    // 입력창 클릭 시 이벤트 전파 방지
    document.getElementById('nai-loop-count').addEventListener('mousedown', (e) => e.stopPropagation());

})();
