# HANDOFF: Buddy Messages Queue/Carousel

## Что сделано
- Два buddy блока одновременно (слева + справа)
- Рандомные цвета из 6 схем
- Жёсткие формулировки ("Ну и чо?", "Там живой кто?")
- Dismiss по клику ×

## Проблема
Сейчас dismiss просто скрывает блок и остаётся пустое место. 
Нужно: **dismiss триггерит появление СЛЕДУЮЩЕГО сообщения** из очереди.

## Что нужно сделать

### 1. Backend: Возвращать ВСЕ insights, не только два
```javascript
// watcher.js — getBuddyMessage()
return {
    insights: allInsights,  // Все доступные insights
    timestamp: new Date().toISOString(),
    projectsCount
};
```

### 2. Frontend: Queue система
```javascript
// app.js
let insightsQueue = [];  // Все insights с сервера
let currentLeftIndex = 0;
let currentRightIndex = 1;

// При dismiss левого блока:
function dismissLeft() {
    currentLeftIndex += 2;  // Берём следующий из очереди
    if (currentLeftIndex < insightsQueue.length) {
        // Показать новый insight с анимацией
        renderBuddyBlock('left', insightsQueue[currentLeftIndex]);
    } else {
        // Очередь закончилась — скрыть блок окончательно
        buddyLeft.classList.add('dismissed');
    }
}
```

### 3. Анимация появления нового блока
```css
.buddy-message.appearing {
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
```

### 4. Опционально: авто-ротация
Если не dismiss'ить, блоки могут сами меняться каждые N секунд (как карусель).

## Файлы для изменения
- `hub/watcher.js` — возвращать полный массив insights
- `hub/app.js` — queue логика, dismiss → next
- `hub/styles.css` — анимация появления

## Вопрос на обсуждение
Нужна ли авто-ротация или только по dismiss?
