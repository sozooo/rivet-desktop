import type { en } from "./en";
import type { Message } from "./i18n";

const files = (count: string) => ({
  one: `${count} файл`,
  few: `${count} файла`,
  many: `${count} файлов`,
  other: `${count} файла`,
});

/** Russian. Same keys as English; TypeScript reports anything missing or extra. */
export const ru: Record<keyof typeof en, Message> = {
  "time.justNow": "только что",
  "common.cancel": "Отмена",
  "common.close": "Закрыть",
  "common.demo": "Демо",
  "common.repositoryRoot": "Корень проекта",
  "common.files": files("{count}"),
  "common.pathCopied": "Путь скопирован",
  "common.shaCopied": "Хеш скопирован",
  "common.clipboardUnavailable": "Буфер обмена недоступен",
  "common.dismiss": "Скрыть",

  "nav.changes": "Изменения",
  "nav.history": "История",
  "nav.branches": "Ветки",
  "nav.lightTheme": "Светлая тема",
  "nav.darkTheme": "Тёмная тема",
  "nav.toggleTheme": "Переключить тему",
  "nav.settings": "Настройки",

  "top.currentBranch":
    "Текущая ветка: {branch}. Нажмите, чтобы перейти на другую.",
  "top.checkRemote": "Проверить, нет ли новых коммитов на сервере",
  "top.noRemote": "Нет сервера",
  "top.neverChecked": "Не проверялось",
  "top.sync.unpublished": "Эта ветка ещё не опубликована.",
  "top.sync.checked": "Проверено {time}.",
  "top.sync.notChecked": "Ещё не проверялось.",
  "top.sync.incoming": "{count} новых из {upstream}",
  "top.sync.toPush": "{count} можно отправить",
  "top.sync.upToDate": "Всё актуально.",
  "top.sync.clickToCheck": "Нажмите, чтобы проверить снова.",
  "top.repositories": "ВАШИ РЕПОЗИТОРИИ",
  "top.repositories@simple": "ВАШИ ПРОЕКТЫ",
  "top.removeRepository": "Убрать {name} из списка (файлы останутся на диске)",
  "top.removeRepositoryLabel": "Убрать {name} из списка",
  "top.pullRequests": "Pull requests",
  "top.pullRequestsTitle": "Открытые pull requests",
  "top.pull": "Получить",
  "top.pullTitle": {
    one: "Получить {count} коммит из {upstream} в {branch} (git pull)",
    few: "Получить {count} коммита из {upstream} в {branch} (git pull)",
    many: "Получить {count} коммитов из {upstream} в {branch} (git pull)",
    other: "Получить {count} коммита из {upstream} в {branch} (git pull)",
  },
  "top.nothingToPull": "Нечего получать",
  "top.push": "Отправить",
  "top.pushTitle": {
    one: "Отправить {count} коммит в {upstream} (git push)",
    few: "Отправить {count} коммита в {upstream} (git push)",
    many: "Отправить {count} коммитов в {upstream} (git push)",
    other: "Отправить {count} коммита в {upstream} (git push)",
  },
  "top.nothingToPush": "Нечего отправлять",
  "top.newBranch": "Новая ветка",
  "top.status.local": "Только на этом компьютере",
  "top.status.unpublished": "Этой ветки ещё нет на сервере",
  "top.status.upToDate": "Всё актуально",
  "top.status.incoming": {
    one: "{count} входящий коммит",
    few: "{count} входящих коммита",
    many: "{count} входящих коммитов",
    other: "{count} входящего коммита",
  },
  "top.status.incoming@simple": {
    one: "{count} новая версия от коллег",
    few: "{count} новые версии от коллег",
    many: "{count} новых версий от коллег",
    other: "{count} новой версии от коллег",
  },
  "top.status.toPublish": "{count} к отправке",
  "top.status.toPublish@simple": {
    one: "{count} версия ждёт отправки",
    few: "{count} версии ждут отправки",
    many: "{count} версий ждут отправки",
    other: "{count} версии ждут отправки",
  },
  "top.busy": "Подождите, пока Rivet закончит",

  "branchMenu.search": "Найти ветку",
  "branchMenu.local": "ЛОКАЛЬНЫЕ ВЕТКИ",
  "branchMenu.local@simple": "ВАШИ ВЕТКИ",
  "branchMenu.remote": "ТОЛЬКО НА СЕРВЕРЕ",
  "branchMenu.remoteHint":
    "Есть только на сервере. При переходе Rivet скачает её в локальную ветку, которая следит за серверной.",
  "branchMenu.remoteHint@simple":
    "Есть только на сервере. Rivet скачает её, когда вы перейдёте.",
  "branchMenu.nothing": "Таких веток нет",
  "branchMenu.new": "Новая ветка…",
  "branchMenu.all": "Все ветки…",
  "top.working.check": "Проверяю…",
  "top.working.sync": "Синхронизирую…",
  "top.working.pull": "Забираю…",
  "top.working.push": "Отправляю…",
  "top.synced": "Всё синхронизировано",
  "top.syncedTitle":
    "С сервера нечего забирать, отправлять тоже нечего. Кнопка ↻ рядом с веткой проверит сервер ещё раз.",
  "top.syncAction.pull": "Забрать обновления",
  "top.syncAction.push": "Отправить",
  "top.syncAction.both": "Синхронизировать",
  "top.syncAction.publish": "Отправить на сервер",
  "top.syncTitle.pull": "Забрать новые версии от коллег",
  "top.syncTitle.push": "Отправить ваши сохранённые версии коллегам",
  "top.syncTitle.both":
    "Забрать новое от коллег, затем отправить ваши сохранённые версии",
  "top.syncTitle.publish":
    "Выложить эту ветку на сервер, чтобы коллеги её увидели",

  "fetch.newCommits": {
    one: "На {upstream} появился {count} новый коммит. Нажмите «Получить», чтобы забрать его.",
    few: "На {upstream} появилось {count} новых коммита. Нажмите «Получить», чтобы забрать их.",
    many: "На {upstream} появилось {count} новых коммитов. Нажмите «Получить», чтобы забрать их.",
    other:
      "На {upstream} появилось {count} новых коммита. Нажмите «Получить», чтобы забрать их.",
  },
  "fetch.newCommits@simple": {
    one: "От коллег пришла {count} новая версия. Нажмите «Синхронизировать», чтобы забрать её.",
    few: "От коллег пришли {count} новые версии. Нажмите «Синхронизировать», чтобы забрать их.",
    many: "От коллег пришло {count} новых версий. Нажмите «Синхронизировать», чтобы забрать их.",
    other:
      "От коллег пришло {count} новой версии. Нажмите «Синхронизировать», чтобы забрать их.",
  },
  "fetch.nothing": "Сервер проверен. Ничего нового.",
  "sync.done": "Всё синхронизировано.",
  "load.title": "Не получилось открыть {name}",
  "load.retry": "Попробовать снова",
  "load.remove": "Убрать из списка",

  "setup.tab.clone": "Клонировать",
  "setup.tab.clone@simple": "Скачать",
  "setup.tab.open": "Добавить",
  "setup.tab.open@simple": "Открыть",
  "setup.tab.create": "Создать",
  "setup.tab.create@simple": "Создать",
  "setup.menu.clone": "Клонировать репозиторий…",
  "setup.menu.clone@simple": "Скачать проект…",
  "setup.menu.open": "Добавить репозиторий с диска…",
  "setup.menu.open@simple": "Открыть проект на компьютере…",
  "setup.menu.create": "Создать репозиторий…",
  "setup.menu.create@simple": "Создать новый проект…",
  "setup.back": "Назад",
  "setup.eyebrow": "МЕСТО ДЛЯ СЛЕДУЮЩЕЙ ИДЕИ",
  "setup.clone.titleStart": "Клонируйте",
  "setup.clone.titleEm": "репозиторий.",
  "setup.clone.titleStart@simple": "Скачайте",
  "setup.clone.titleEm@simple": "проект.",
  "setup.clone.text":
    "Возьмите проект с сервера и получите его копию у себя на компьютере.",
  "setup.open.titleStart": "Соберите работу",
  "setup.open.titleEm": "вместе.",
  "setup.open.text":
    "Добавьте проект, который уже лежит на этом компьютере. Файлы останутся на своём месте.",
  "setup.create.titleStart": "Начните что-то",
  "setup.create.titleEm": "новое.",
  "setup.create.text":
    "Дайте новому проекту дом: пустая папка и основная ветка main.",
  "setup.url": "Адрес репозитория",
  "setup.url@simple": "Ссылка на проект",
  "setup.urlHint": "Подойдут ссылки HTTPS и SSH.",
  "setup.name": "Название репозитория",
  "setup.name@simple": "Название проекта",
  "setup.folder.open": "Папка репозитория",
  "setup.folder.open@simple": "Папка проекта",
  "setup.folder.clone": "Куда положить",
  "setup.folder.create": "Родительская папка",
  "setup.browse": "Обзор…",
  "setup.hint.open": "Выберите папку или один из найденных проектов ниже.",
  "setup.hint.other": "Внутри появится отдельная папка проекта.",
  "setup.initialBranch": "Начальная ветка",
  "setup.found": "НАЙДЕНО НА ЭТОМ КОМПЬЮТЕРЕ",
  "setup.alreadyAdded": "Уже в списке",
  "setup.addPath": "Добавить {path}",
  "setup.added": "Добавлен",
  "setup.add": "Добавить",
  "setup.localWorkspace": "ПАПКА НА КОМПЬЮТЕРЕ",
  "setup.note.browser":
    "Демо-интерфейс · запись сохраняется только в браузере, папки не создаются и не читаются.",
  "setup.note.signIn":
    "Если сервер попросит войти в аккаунт, откроется окно входа.",
  "setup.submit.clone": "Клонировать",
  "setup.submit.clone@simple": "Скачать",
  "setup.submit.clonePreview": "Добавить демо-копию",
  "setup.submit.open": "Добавить репозиторий",
  "setup.submit.open@simple": "Открыть проект",
  "setup.submit.create": "Создать репозиторий",
  "setup.submit.create@simple": "Создать проект",
  "setup.submit.createPreview": "Создать демо",
  "setup.cloning": "Скачиваю…",
  "setup.working": "Минутку…",
  "setup.error.nameLocation": "Укажите название и папку.",
  "setup.error.url": "Укажите ссылку на репозиторий: HTTPS или SSH.",
  "setup.error.folderName":
    'В названии папки не должно быть символов \\ / : * ? " < > |',
  "setup.error.duplicate": "Эта папка уже есть в списке.",
  "setup.error.duplicateRepository": "Этот репозиторий уже есть в списке.",
  "setup.error.folderMissing": "Такой папки нет.",
  "setup.error.notRepository":
    "В этой папке ещё нет Git-репозитория. Его можно создать на вкладке «Создать».",
  "setup.footer": "Ваши проекты. Ваш порядок.",
  "setup.closeLabel": "Закрыть",
  "setup.destination": "Склонируется в {path}",
  "setup.destination@simple": "Скачается в {path}",
  "setup.github.title": "Ваши репозитории на GitHub",
  "setup.github.title@simple": "Ваши проекты на GitHub",
  "setup.github.text": "Войдите и выбирайте из списка, без копирования ссылок.",
  "setup.github.text@simple":
    "Войдите, и ваши проекты появятся списком. Ссылки искать не придётся.",
  "setup.github.heading": "ВАШ GITHUB · @{login}",
  "setup.github.manual": "Вставить ссылку",
  "setup.github.backToList": "К моему списку",
  "setup.github.refresh": "Обновить список",
  "setup.github.search": "Найти репозиторий",
  "setup.github.search@simple": "Найти проект",
  "setup.github.loading": "Загружаю ваши репозитории…",
  "setup.github.loading@simple": "Загружаю ваши проекты…",
  "setup.github.empty": "В этом аккаунте пока нет репозиториев.",
  "setup.github.empty@simple": "В этом аккаунте пока нет проектов.",
  "setup.github.noMatches": "По запросу «{query}» ничего нет.",
  "setup.github.error": "Не получилось загрузить список: {message}",
  "setup.github.retry": "Попробовать снова",
  "setup.github.private": "Приватный",
  "setup.github.private@simple": "Закрытый",
  "setup.github.updated": "Обновлён {time}",
  "setup.github.pick": "Выберите репозиторий из списка.",
  "setup.github.pick@simple": "Выберите проект из списка.",
  "art.label": "МЕСТО ДЛЯ НОВОГО",
  "art.title1": "Всё видно.",
  "art.title2": "Всё под рукой.",
  "art.text1": "Всё, что нужно, чтобы следить за изменениями,",
  "art.text2": "от первой версии до следующей.",
  "art.bottom": "ПОСТРОЕНО НА GIT",
  "art.bottomRight": "01 — ВАШЕ ПРОСТРАНСТВО",
  "art.illustration": "Папки проекта, связанные линиями версий",

  "status.added": "новый",
  "status.modified": "изменён",
  "status.deleted": "удалён",
  "status.renamed": "перемещён",
  "status.addedTitle": "Новый файл",
  "status.modifiedTitle": "Изменён",
  "status.deletedTitle": "Удалён",
  "status.renamedTitle": "Перемещён или переименован",
  "meta.importSettings": "изменены настройки импорта",
  "meta.newFolder": "новая папка",
  "meta.folderRemoved": "папка удалена",
  "meta.withMeta": "вместе с .meta-файлом",

  "changes.title": "Изменения",
  "changes.filter": "Найти файл…",
  "changes.selectAll": "Выбрать всё",
  "changes.unselectAll": "Снять выбор",
  "changes.count": {
    one: "{count} ИЗМЕНЕНИЕ",
    few: "{count} ИЗМЕНЕНИЯ",
    many: "{count} ИЗМЕНЕНИЙ",
    other: "{count} ИЗМЕНЕНИЯ",
  },
  "changes.none": "НЕТ ИЗМЕНЕНИЙ",
  "changes.stashAll": "Отложить всё",
  "changes.stashAll@simple": "Отложить",
  "changes.stashAllTitle":
    "Убрать все изменения в сторону и получить чистую рабочую копию. Вернуть их можно в любой момент из списка ниже.",
  "changes.stashed": "Изменения отложены. Вернуть их можно из списка ниже.",
  "changes.stashed@simple":
    "Изменения отложены в сторону. Вернуть их можно из списка ниже.",
  "changes.restored": "Отложенные изменения возвращены.",
  "changes.restored@simple": "Изменения вернулись.",
  "changes.include": "Включить {name} в коммит",
  "changes.include@simple": "Включить {name} в версию",
  "changes.exclude": "Не включать {name} в коммит",
  "changes.exclude@simple": "Не включать {name} в версию",
  "changes.clean": "Рабочая копия чистая.",
  "changes.clean@simple": "С последнего сохранения ничего не менялось.",
  "changes.noMatches": "Ничего не найдено.",
  "changes.footer": "Рабочая копия",
  "changes.footer@simple": "Ваши файлы",
  "changes.workingChanges": "Изменения в рабочей копии",
  "changes.workingChanges@simple": "Что изменилось",
  "changes.motto": "Посмотрите. Выберите. Закоммитьте.",
  "changes.motto@simple": "Посмотрите. Сохраните. Синхронизируйте.",
  "changes.diffContext": "Рабочая копия → HEAD",
  "changes.emptyTitle": "Всё на своих местах.",
  "changes.emptyStashed":
    "Рабочая копия чистая. Отложенные изменения ждут в списке.",
  "changes.emptyStashed@simple":
    "Ничего не менялось. Отложенные изменения ждут в списке.",

  "composer.title": "Коммит",
  "composer.title@simple": "Сохранить версию",
  "composer.nothing": "Нечего коммитить",
  "composer.nothing@simple": "Нечего сохранять",
  "composer.selected": {
    one: "Выбрано {selected} из {count} файла",
    few: "Выбрано {selected} из {count} файлов",
    many: "Выбрано {selected} из {count} файлов",
    other: "Выбрано {selected} из {count} файлов",
  },
  "composer.all": {
    one: "Ничего не выбрано, поэтому в коммит войдёт {count} файл",
    few: "Ничего не выбрано, поэтому в коммит войдут все {count} файла",
    many: "Ничего не выбрано, поэтому в коммит войдут все {count} файлов",
    other: "Ничего не выбрано, поэтому в коммит войдут все {count} файла",
  },
  "composer.all@simple": {
    one: "Сохранится {count} файл",
    few: "Сохранятся все {count} файла",
    many: "Сохранятся все {count} файлов",
    other: "Сохранятся все {count} файла",
  },
  "composer.on": "в",
  "composer.summary": "Описание коммита",
  "composer.summaryPlaceholder": "Коротко и по делу: что изменилось…",
  "composer.summaryPlaceholder@simple":
    "Что изменилось? Например: новые текстуры деревьев",
  "composer.summaryShort": "Описание коммита…",
  "composer.description": "Подробности коммита",
  "composer.descriptionPlaceholder": "Подробности (необязательно)",
  "composer.local": "· Локальный коммит",
  "composer.local@simple": "· Хранится на этом компьютере до синхронизации",
  "composer.noChanges": "Нет изменений для коммита",
  "composer.noChanges@simple": "Нечего сохранять",
  "composer.needSummary": "Сначала напишите описание",
  "composer.needSummary@simple": "Сначала напишите, что изменилось",
  "composer.shortcut": "Закоммитить (Ctrl+Enter)",
  "composer.shortcut@simple": "Сохранить (Ctrl+Enter)",
  "composer.button": "Закоммитить",
  "composer.button@simple": "Сохранить версию",
  "composer.buttonSelected": {
    one: "Закоммитить {count} файл",
    few: "Закоммитить {count} файла",
    many: "Закоммитить {count} файлов",
    other: "Закоммитить {count} файла",
  },
  "composer.buttonSelected@simple": "Сохранить версию",
  "composer.buttonAll": {
    one: "Закоммитить {count} файл",
    few: "Закоммитить все {count} файла",
    many: "Закоммитить все {count} файлов",
    other: "Закоммитить все {count} файла",
  },
  "composer.buttonAll@simple": "Сохранить версию",
  "composer.done": {
    one: "Закоммичен {count} файл.",
    few: "Закоммичено {count} файла.",
    many: "Закоммичено {count} файлов.",
    other: "Закоммичено {count} файла.",
  },
  "composer.done@simple":
    "Версия сохранена. Нажмите «Синхронизировать», чтобы поделиться ею.",

  "stash.heading": "ОТЛОЖЕНО",
  "stash.heading@simple": "ОТЛОЖЕНО",
  "stash.defaultName": "Изменения в {branch}",
  "stash.defaultName@simple": "Отложенные изменения",
  "stash.restore": "Вернуть",
  "stash.restore@simple": "Вернуть",
  "stash.restoreTitle":
    "Вернуть эти изменения в рабочие файлы и убрать их из отложенных",
  "stash.delete": "Удалить отложенное…",
  "stash.deleteLabel": "Удалить отложенное «{name}»",
  "stash.back": "К изменениям",
  "stash.eyebrow": "ОТЛОЖЕННЫЕ ИЗМЕНЕНИЯ",
  "stash.eyebrow@simple": "ОТЛОЖЕННЫЕ ИЗМЕНЕНИЯ",
  "stash.restoreChanges": "Вернуть изменения",
  "stash.restoreChanges@simple": "Вернуть",
  "stash.deleteButton": "Удалить…",
  "stash.context": "Отложенное → HEAD",

  "history.title": "История",
  "history.search": "Поиск по истории…",
  "history.all": "ВСЕ КОММИТЫ",
  "history.all@simple": "ВСЕ ВЕРСИИ",
  "history.noMatches": "Ничего не найдено.",
  "history.footer": "Локальный репозиторий",
  "history.emptyTitle": "Коммитов пока нет",
  "history.emptyTitle@simple": "Сохранённых версий пока нет",
  "history.emptyText": "Здесь появится ваш первый коммит.",
  "history.emptyText@simple": "Здесь появится первая сохранённая версия.",
  "history.details": "КОММИТ",
  "history.details@simple": "ВЕРСИЯ",
  "history.copySha": "Скопировать хеш",
  "history.parent": {
    one: "Родитель",
    few: "Родители",
    many: "Родители",
    other: "Родители",
  },
  "history.checkout": "Перейти к коммиту…",
  "history.cherryPick": "Перенести (cherry-pick)…",
  "history.revert": "Отменить коммит…",
  "history.context": "Коммит → родитель",

  "history.undo": "Вернуть в изменения…",
  "history.undo@simple": "Отменить это сохранение",
  "history.restore": "Вернуть эту версию",
  "history.restore@simple": "Вернуть файл к этой версии",
  "history.restoreTitle":
    "Сделать {name} таким, как в этом коммите. Перед коммитом его можно будет посмотреть.",
  "history.restoreTitle@simple":
    "{name} станет таким, каким был в этой версии. Перед сохранением его можно посмотреть.",
  "history.fileHistory": "История файла",
  "history.fileHistory@simple": "Все версии файла",
  "history.fileVersions": "ИСТОРИЯ ФАЙЛА",
  "history.fileVersions@simple": "ВЕРСИИ ФАЙЛА",
  "history.showAll": "Показать все коммиты",
  "history.showAll@simple": "Показать все версии",
  "history.noVersions": "Этот файл не менялся ни в одном коммите.",
  "history.noVersions@simple": "У этого файла пока нет сохранённых версий.",
  "undo.action": "Отменить",
  "undo.blocked.pushed":
    "Этот коммит уже отправлен. Отменить его можно только новым коммитом (Revert).",
  "undo.blocked.pushed@simple":
    "Эта версия уже отправлена коллегам — отменить её можно только новой версией.",
  "undo.blocked.merge":
    "Это merge-коммит. Rivet отменяет только обычные коммиты.",
  "undo.blocked.merge@simple":
    "В этой версии ваша работа соединилась с работой коллег. Её нельзя отменить здесь.",
  "undo.blocked.first": "Это первый коммит: до него возвращаться некуда.",
  "undo.blocked.first@simple":
    "Это самая первая версия проекта, её нельзя отменить.",
  "undo.blocked.merging": "Сначала завершите или отмените слияние.",
  "undo.blocked.merging@simple":
    "Сначала выберите, какую версию оставить для файлов с конфликтом.",
  "undo.blocked.moved": "Отменить можно только последний коммит.",
  "undo.blocked.moved@simple":
    "Отменить можно только последнюю сохранённую версию.",
  "op.undo-commit.title": "Вернуть коммит в изменения",
  "op.undo-commit.title@simple": "Отменить последнее сохранение",
  "op.undo-commit.describe":
    "Убрать «{summary}» из {branch}. Изменения останутся в файлах и вернутся в список выбранными, а сообщение — в форму коммита. Коммит ещё не отправлен, так что ни у кого его нет.",
  "op.undo-commit.describe@simple":
    "Версия «{summary}» исчезнет из истории. Файлы останутся как есть: изменения вернутся в список, а описание — в поле сохранения, чтобы можно было что-то поправить и сохранить заново.",
  "op.undo-commit.confirm": "Вернуть в изменения",
  "op.undo-commit.confirm@simple": "Отменить сохранение",
  "op.undo-commit.done":
    "Коммит отменён. Изменения снова в списке, сообщение — в форме коммита.",
  "op.undo-commit.done@simple":
    "Сохранение отменено. Изменения снова в списке — можно поправить и сохранить заново.",
  "op.restore-file.title": "Вернуть файл",
  "op.restore-file.title@simple": "Вернуть файл к этой версии",
  "op.restore-file.describe":
    "Заменить {path} версией из {sha} «{summary}». Незакоммиченные изменения в нём пропадут. Восстановленный файл станет обычным изменением: его можно посмотреть и закоммитить.",
  "op.restore-file.describe@simple":
    "Файл {name} станет таким, каким был в версии «{summary}». Несохранённые изменения в этом файле пропадут.",
  "op.restore-file.confirm": "Вернуть",
  "op.restore-file.confirm@simple": "Вернуть",
  "op.restore-file.done":
    "Файл {name} возвращён к версии {sha}. Посмотрите его в «Изменениях» и закоммитьте.",
  "op.restore-file.done@simple":
    "Файл {name} снова такой, как в версии «{summary}». Посмотрите его в «Изменениях» и сохраните, если всё так.",
  "restore.same": "Файл {name} уже совпадает с этой версией.",
  "restore.review": "Посмотреть",
  "restore.review@simple": "Посмотреть",
  "incoming.toast": {
    one: "{count} новый коммит в {upstream}",
    few: "{count} новых коммита в {upstream}",
    many: "{count} новых коммитов в {upstream}",
    other: "{count} новых коммита в {upstream}",
  },
  "incoming.toast@simple": "Пришли обновления от коллег: {count}",
  "incoming.take": "Получить…",
  "incoming.take@simple": "Забрать",
  "incoming.taking": "Забираю обновления…",
  "op.pull.done@simple": "Готово: работа коллег теперь у вас.",

  "branches.title": "Ветки",
  "branches.search": "Поиск веток…",
  "branches.local": "ЛОКАЛЬНЫЕ",
  "branches.remote": "НА СЕРВЕРЕ",
  "branches.tags": "ТЕГИ",
  "branches.current": "Текущая ветка",
  "branches.overview": "ВЕТКА",
  "branches.youAreHere": "Вы на этой ветке",
  "branches.localBranch": "Локальная ветка",
  "branches.remoteOrTag": "Ветка на сервере или тег",
  "branches.newFromHere": "Новая ветка отсюда…",
  "branches.switch": "Перейти на эту ветку",
  "branches.notTag": "Перейти можно только на ветку, не на тег",
  "branches.merge": "Слить в {branch}…",
  "branches.rebase": "Перебазировать {branch} на неё…",
  "branches.compared": "По сравнению с main",
  "branches.ahead": {
    one: "коммит впереди",
    few: "коммита впереди",
    many: "коммитов впереди",
    other: "коммита впереди",
  },
  "branches.behind": {
    one: "коммит позади",
    few: "коммита позади",
    many: "коммитов позади",
    other: "коммита позади",
  },
  "branches.diagram": "main и {branch} расходятся от общего коммита",
  "branches.note":
    "Изменения остаются в своей ветке. Ничего не происходит, пока вы сами не решите.",
  "branches.recent": "Последние коммиты",
  "branches.viewHistory": "Вся история",

  "diff.unified": "Единый вид",
  "diff.split": "Рядом",
  "diff.actions": "Действия с файлом",
  "diff.copyPath": "Скопировать путь",
  "diff.discard": "Отменить изменения…",
  "diff.discard@simple": "Вернуть как было…",
  "diff.whitespace": "Пробелы",
  "diff.whitespaceTitle": "Показать или скрыть пробелы",
  "diff.original": "Было",
  "diff.modified": "Стало",
  "diff.includePart": "Включить этот фрагмент в коммит",
  "diff.excludePart": "Убрать этот фрагмент из коммита",

  "files.changed": "Изменённые файлы",
  "files.show": "Показать изменённые файлы ({count})",
  "files.collapse": "Свернуть список файлов",
  "files.find": "Найти файл или папку…",
  "files.searchLabel": "Поиск по изменённым файлам",
  "files.list": "Список изменённых файлов",
  "files.noMatches": "Ничего не найдено.",
  "files.summary": {
    one: "{count} файл · выберите, чтобы посмотреть",
    few: "{count} файла · выберите, чтобы посмотреть",
    many: "{count} файлов · выберите, чтобы посмотреть",
    other: "{count} файла · выберите, чтобы посмотреть",
  },
  "files.summaryFiltered": {
    one: "{shown} из {count} файла · выберите, чтобы посмотреть",
    few: "{shown} из {count} файлов · выберите, чтобы посмотреть",
    many: "{shown} из {count} файлов · выберите, чтобы посмотреть",
    other: "{shown} из {count} файлов · выберите, чтобы посмотреть",
  },
  "files.inspect": "Посмотреть {path}",
  "files.diffPane": "Изменения выбранного файла",
  "files.resize": "Изменить ширину списка файлов",

  "panes.collapse": "Свернуть панель",
  "panes.expand": "Развернуть панель",
  "panes.resize": "Изменить ширину панели",
  "statusbar.demo": "Демо-данные · на диск ничего не записывается",
  "statusbar.shortcuts": "Горячие клавиши",

  "dialog.close": "Закрыть",
  "dialog.eyebrow": "ОПЕРАЦИЯ GIT",
  "dialog.eyebrow@simple": "ДЕЙСТВИЕ",
  "dialog.eyebrowPreview": "ОПЕРАЦИЯ GIT · ПРЕДПРОСМОТР",
  "dialog.demoNote": "Демо-репозиторий: на диске ничего не изменится.",
  "dialog.cannotYet":
    "Rivet пока не умеет это делать. Команда ниже делает то же самое в терминале.",
  "dialog.showCommand": "Показать команду Git",

  "op.switch-branch.title": "Перейти на ветку",
  "op.switch-branch.describe":
    "Перейти с {branch} на {target}. Файлы рабочей копии станут такими, как в {target}.",
  "op.switch-branch.describe@simple":
    "Перейти с ветки {branch} на {target}. Файлы в папке проекта станут такими, как в {target}.",
  "op.switch-branch.changes": {
    one: "{count} незакоммиченный файл переедет с вами на {target}. Чтобы оставить его здесь, сначала закоммитьте его или уберите в stash.",
    few: "{count} незакоммиченных файла переедут с вами на {target}. Чтобы оставить их здесь, сначала закоммитьте их или уберите в stash.",
    many: "{count} незакоммиченных файлов переедут с вами на {target}. Чтобы оставить их здесь, сначала закоммитьте их или уберите в stash.",
    other:
      "{count} незакоммиченного файла переедут с вами на {target}. Чтобы оставить их здесь, сначала закоммитьте их или уберите в stash.",
  },
  "op.switch-branch.changes@simple": {
    one: "{count} несохранённый файл переедет с вами на {target}. Если он нужен только здесь, сначала сохраните или отложите его.",
    few: "{count} несохранённых файла переедут с вами на {target}. Если они нужны только здесь, сначала сохраните или отложите их.",
    many: "{count} несохранённых файлов переедут с вами на {target}. Если они нужны только здесь, сначала сохраните или отложите их.",
    other:
      "{count} несохранённого файла переедут с вами на {target}. Если они нужны только здесь, сначала сохраните или отложите их.",
  },
  "op.switch-branch.confirm": "Перейти",
  "op.switch-branch.done": "Вы на ветке {target}.",
  "op.new-branch.title": "Новая ветка",
  "op.new-branch.describe":
    "Создать ветку от последнего коммита в {branch}. Вы останетесь на {branch}.",
  "op.new-branch.confirm": "Создать ветку",
  "op.new-branch.done": "Ветка {name} создана.",
  "op.new-branch.label": "Название ветки",
  "op.new-branch.empty": "Введите название.",
  "op.new-branch.exists": "Ветка с таким названием уже есть.",
  "op.pull.title": "Получить изменения",
  "op.pull.describe": {
    one: "Получить {count} коммит из {upstream} в {branch}. {how}",
    few: "Получить {count} коммита из {upstream} в {branch}. {how}",
    many: "Получить {count} коммитов из {upstream} в {branch}. {how}",
    other: "Получить {count} коммита из {upstream} в {branch}. {how}",
  },
  "op.pull.merge":
    "В вашей ветке тоже есть неотправленные коммиты, поэтому Git соединит обе истории merge-коммитом. Ничего не перебазируется.",
  "op.pull.forward": "Ваша ветка просто продвинется вперёд.",
  "op.pull.confirm": "Получить",
  "op.pull.done": "Свежие коммиты получены.",
  "op.push.title": "Отправить",
  "op.push.describe": {
    one: "Отправить {count} коммит из {branch} в {upstream}.",
    few: "Отправить {count} коммита из {branch} в {upstream}.",
    many: "Отправить {count} коммитов из {branch} в {upstream}.",
    other: "Отправить {count} коммита из {branch} в {upstream}.",
  },
  "op.push.confirm": "Отправить",
  "op.push.done": "Отправлено. На сервере всё актуально.",
  "op.discard-file.title": "Отменить изменения",
  "op.discard-file.title@simple": "Вернуть как было",
  "op.discard-file.describe":
    "Выбросить все изменения в {path}, включая выбранные для коммита. Это нельзя отменить.",
  "op.discard-file.describe@simple":
    "Вернуть {path} к последней сохранённой версии. Ваши изменения в нём пропадут, и вернуть их будет нельзя.",
  "op.discard-file.confirm": "Отменить изменения",
  "op.discard-file.confirm@simple": "Вернуть как было",
  "op.discard-file.done": "Изменения в {path} отменены.",
  "op.discard-file.done@simple": "{path} снова как в сохранённой версии.",
  "op.drop-stash.title": "Удалить отложенное",
  "op.drop-stash.title@simple": "Удалить отложенное",
  "op.drop-stash.describe": {
    one: "Удалить «{name}» ({count} файл). Это нельзя отменить.",
    few: "Удалить «{name}» ({count} файла). Это нельзя отменить.",
    many: "Удалить «{name}» ({count} файлов). Это нельзя отменить.",
    other: "Удалить «{name}» ({count} файла). Это нельзя отменить.",
  },
  "op.drop-stash.confirm": "Удалить",
  "op.drop-stash.confirm@simple": "Удалить",
  "op.drop-stash.done": "Отложенное удалено.",
  "op.drop-stash.done@simple": "Удалено.",
  "op.merge.title": "Слить ветку",
  "op.merge.describe": "Слить {target} в вашу текущую ветку {branch}.",
  "op.merge.confirm": "Слить",
  "op.rebase.title": "Перебазировать",
  "op.rebase.describe":
    "Переложить коммиты {branch} поверх {target}. Их хеши изменятся.",
  "op.rebase.confirm": "Перебазировать",
  "op.checkout.title": "Перейти к коммиту",
  "op.checkout.describe":
    "Посмотреть проект ровно таким, каким он был в {sha}. Пока не вернётесь, вы будете вне ветки.",
  "op.checkout.confirm": "Перейти",
  "op.cherry-pick.title": "Перенести коммит",
  "op.cherry-pick.describe":
    "Скопировать изменения из {sha} в {branch} новым коммитом.",
  "op.cherry-pick.confirm": "Перенести",
  "op.revert.title": "Отменить коммит",
  "op.revert.describe":
    "Добавить в {branch} новый коммит, который отменяет {sha}. История не переписывается.",
  "op.revert.confirm": "Отменить коммит",

  "settings.eyebrow": "НАСТРОЙТЕ ПОД СЕБЯ",
  "settings.title": "Настройки",
  "settings.appearance": "Оформление",
  "settings.light": "Светлое",
  "settings.dark": "Тёмное",
  "settings.system": "Как в системе",
  "settings.language": "Язык",
  "settings.mode": "Режим",
  "settings.simple": "Простой",
  "settings.full": "Полный",
  "settings.simpleHint":
    "Простые слова и только то, что нужно, чтобы сохранять работу и делиться ею.",
  "settings.fullHint":
    "Все инструменты Git: ветки, фрагменты файлов, операции с историей.",
  "settings.version": "Rivet {version}",
  "settings.account": "Аккаунт GitHub",

  "github.signIn": "Войти через GitHub",
  "github.signOut": "Выйти",
  "github.signOutHint":
    "Rivet и Git на этом компьютере забудут этот вход. Репозитории останутся как есть.",
  "github.signOutHint@simple":
    "Rivet забудет этот вход на этом компьютере. Проекты останутся как есть.",
  "github.checking": "Проверяю…",
  "github.notSignedIn": "Вход не выполнен",
  "github.signInHint": "Войдите, чтобы клонировать свои репозитории из списка.",
  "github.signInHint@simple":
    "Войдите, чтобы скачивать свои проекты из списка.",
  "github.notConfigured":
    "Для входа через GitHub нужен Client ID приложения OAuth в src/github/config.ts. Как его получить, написано в README.md.",
  "github.signedIn": "Вы вошли как @{login}",
  "github.signedOut": "Вы вышли из GitHub",

  "signin.eyebrow": "GITHUB",
  "signin.title": "Вход через GitHub",
  "signin.text":
    "Откройте GitHub в браузере и введите там этот код. Rivet подождёт здесь и дальше всё сделает сам.",
  "signin.codeLabel": "Код для GitHub",
  "signin.copy": "Скопировать код",
  "signin.copied": "Скопировано",
  "signin.open": "Скопировать код и открыть GitHub",
  "signin.requesting": "Получаю код у GitHub…",
  "signin.waiting": "Жду подтверждения на GitHub…",
  "signin.manual": "Если браузер не открылся, зайдите на {url} сами.",
  "signin.demo":
    "Демо: вход завершится сам через пару секунд после того, как вы откроете GitHub.",
  "signin.retry": "Попробовать снова",
  "signin.error.expired":
    "Код устарел. Нажмите «Попробовать снова», чтобы получить новый.",
  "signin.error.denied": "Вход отменён на GitHub.",
  "signin.error.notConfigured":
    "GitHub не узнал Client ID приложения. Проверьте src/github/config.ts.",
  "signin.error.notConfigured@simple":
    "Вход через GitHub в этой копии Rivet ещё не настроен. Попросите того, кто её установил, проверить.",
  "signin.error.disabled":
    "У приложения OAuth выключен Device Flow. Включите его в настройках приложения на GitHub.",
  "signin.error.disabled@simple":
    "Вход через GitHub в этой копии Rivet ещё не настроен. Попросите того, кто её установил, проверить.",
  "signin.error.network":
    "Не получается связаться с GitHub. Проверьте интернет и попробуйте снова.",
  "signin.error.unexpected": "Не получилось войти: {message}",

  "shortcuts.eyebrow": "ШПАРГАЛКА",
  "shortcuts.title": "Горячие клавиши",
  "shortcuts.commit": "Закоммитить из поля описания",
  "shortcuts.commit@simple": "Сохранить версию из поля описания",
  "shortcuts.escape": "Закрыть окно или меню",
  "shortcuts.resize": "Изменить ширину выбранной панели",
  "shortcuts.tab": "Переходить между элементами и нажимать их",

  "preview.showText": "Показать как текст",
  "preview.showPreview": "Показать превью",
  "preview.loading": "Загружаю…",
  "preview.before": "Было",
  "preview.after": "Стало",
  "preview.added": "Новый файл",
  "preview.deleted": "Удалён",
  "preview.sideBySide": "Рядом",
  "preview.swipe": "Шторка",
  "preview.onion": "Наложение",
  "preview.on": "вкл.",
  "preview.off": "выкл.",
  "preview.showMore": "Показать ещё {count}",
  "preview.size": "{width} × {height} пикс. · {size}",
  "preview.noPreview": "Rivet пока не умеет показывать такие файлы.",
  "preview.binary": "Двоичный файл",
  "preview.lfs": "Хранится в Git LFS и ещё не скачан",
  "preview.lfsHint":
    "В Git лежит только ссылка на этот файл, а сам файл — на сервере. Скачайте его, чтобы посмотреть.",
  "preview.imageFailed": "Это изображение не получается показать.",
  "preview.psdFlat":
    "Файл Photoshop: показан сведённым, как его сохранили с «Максимальной совместимостью».",
  "preview.unityData": "Изменены данные Unity",
  "preview.unityDataHint":
    "Это служебные данные Unity. Их читает сам Unity, картинки здесь нет.",
  "preview.unityBinary": "Сохранён в двоичном формате Unity",
  "preview.unityBinaryHint":
    "Rivet читает файлы Unity, сохранённые как текст. Чтобы переключить, откройте в Unity Edit → Project Settings → Editor и выберите Asset Serialization: Force Text.",
  "preview.meta.importSettings": "Изменены настройки импорта",
  "preview.meta.hint":
    "В этом файле Unity хранит, как импортировать {asset}: размер, сжатие, тип и похожие настройки.",
  "meta.created": "Созданы настройки импорта для {asset}",
  "meta.removed": "Удалены настройки импорта для {asset}",
  "meta.guidChanged":
    "У ассета новый ID (GUID). Сцены, префабы и материалы, где он использовался, могут потерять связь с ним.",
  "meta.noSettings":
    "Сами настройки не изменились, поменялись только служебные данные Unity.",
  "model.vertices": "Вершины",
  "model.triangles": "Треугольники",
  "model.meshes": "Меши",
  "model.materials": "Материалы",
  "model.bones": "Кости",
  "model.animations": "Анимации",
  "model.noAnimations": "Анимаций нет",
  "model.play": "Проиграть {name}",
  "model.seconds": "{value} с",
  "model.failed": "Эту модель не получается показать: {error}",
  "model.oldFbx":
    "Этот FBX сохранён в старом формате (до 7.0). Переэкспортируйте его из 3D-редактора, чтобы посмотреть.",
  "model.drag": "Тяните, чтобы повернуть, колёсико — приблизить",
  "model.textures": "Текстуры здесь не показываются, модель нарисована серым.",
  "model.skeleton":
    "В этом файле есть скелет, но нет меша, поэтому кости нарисованы палочками.",
  "material.title": "Материал {name}",
  "material.noChanges": "Изменились только технические детали материала.",
  "material.shader": "Шейдер",
  "material.packageShader": "Шейдер из пакета",
  "material.approximate": "Примерный вид",
  "material.textureChanged": "текстура заменена",
  "material.none": "нет",
  "material.baseColor": "Основной цвет",
  "material.baseMap": "Основная текстура",
  "material.normalMap": "Карта нормалей",
  "material.normalStrength": "Сила нормалей",
  "material.smoothness": "Гладкость",
  "material.metallic": "Металличность",
  "material.metallicMap": "Карта металличности",
  "material.occlusionMap": "Карта затенения",
  "material.occlusionStrength": "Сила затенения",
  "material.emissionColor": "Цвет свечения",
  "material.emissionMap": "Карта свечения",
  "material.alphaCutoff": "Порог прозрачности",
  "material.heightMap": "Карта высот",
  "material.detailMap": "Карта деталей",
  "scene.summary": {
    one: "Изменён {count} объект",
    few: "Изменено {count} объекта",
    many: "Изменено {count} объектов",
    other: "Изменено {count} объекта",
  },
  "scene.noChanges":
    "Объекты не изменились, поменялись только служебные данные Unity.",
  "scene.settingsOnly": "Изменились только настройки сцены",
  "scene.added": "Добавлен в {parent}",
  "scene.addedRoot": "Добавлен",
  "scene.removed": "Удалён из {parent}",
  "scene.removedRoot": "Удалён",
  "scene.renamed": "Переименован: {before} → {after}",
  "scene.reparented": "Перемещён в иерархии: {before} → {after}",
  "scene.top": "корень",
  "scene.on": "Включён",
  "scene.off": "Выключен",
  "scene.position": "Позиция {before} → {after}",
  "scene.rotation": "Поворот {before} → {after}",
  "scene.scale": "Масштаб {before} → {after}",
  "scene.componentAdded": "Добавлен компонент {component}",
  "scene.componentRemoved": "Удалён компонент {component}",
  "scene.componentChanged": "{component}: {fields}",
  "scene.prefabAdded": "Поставлен префаб",
  "scene.prefabAddedUnder": "Префаб поставлен в {parent}",
  "scene.prefabRemoved": "Префаб убран",
  "scene.override": "Переопределено {property}: {before} → {after}",
  "scene.otherAsset": "другой ассет",
  "scene.unset": "не задано",
  "scene.otherObject": "другой объект",
  "scene.builtIn": "встроенный",
  "scene.axis.position": "Позиция {axis}",
  "scene.axis.rotation": "Поворот {axis}",
  "scene.axis.scale": "Масштаб {axis}",
  "updates.available": "Доступна версия {version}",
  "updates.eyebrow": "ОБНОВЛЕНИЕ",
  "updates.title": "Новая версия Rivet {version}",
  "updates.notes": "Что нового",
  "updates.noNotes": "Описания к этой версии нет.",
  "updates.hint":
    "После обновления Rivet перезапустится. Ваши файлы и неотправленные версии никуда не денутся.",
  "updates.later": "Позже",
  "updates.install": "Обновить и перезапустить",
  "updates.installing": "Скачиваю… {percent}%",
  "updates.installingNoSize": "Скачиваю…",
  "updates.failed": "Не получилось обновиться: {error}",
  "settings.checkUpdates": "Проверить обновления",
  "settings.checking": "Проверяю…",
  "settings.upToDate": "Установлена последняя версия.",
  "settings.unpublished": "Опубликованных версий пока нет.",
  "settings.updateAvailable": "Доступна версия {version}.",
  "settings.updateError":
    "Не получилось проверить обновления. Есть ли интернет?",
  "prs.title": "Pull requests",
  "prs.open": "открыто: {count}",
  "prs.close": "Закрыть pull requests",
  "prs.eyebrow": "PULL REQUEST #{id}",
  "prs.comments": {
    one: "{count} комментарий",
    few: "{count} комментария",
    many: "{count} комментариев",
    other: "{count} комментария",
  },
  "prs.files": {
    one: "{count} изменённый файл",
    few: "{count} изменённых файла",
    many: "{count} изменённых файлов",
    other: "{count} изменённого файла",
  },
  "prs.review.ready": "Ждёт ревью",
  "prs.review.approved": "Одобрен",
  "prs.review.draft": "Черновик",
  "prs.checks.passed": "Все проверки пройдены",
  "prs.checks.running": "Проверки ещё идут",
  "prs.explanation":
    "Pull request предлагает слить одну ветку в другую. Кнопка «Получить» вверху забирает коммиты в вашу текущую ветку.",
  "prs.footer": "Демо pull requests · сервис хостинга не подключён.",

  "side.mine": "Моя версия",
  "side.theirs.merge": "Версия с сервера",
  "side.theirs.other": "Входящая версия",
  "side.mine.stash": "Текущая версия",
  "side.theirs.stash": "Отложенная версия",

  "merge.title.merge": "Слияние остановилось на конфликтах",
  "merge.title.merge@simple": "Вы и коллеги изменили одни и те же файлы",
  "merge.title.rebase": "Перебазирование остановилось на конфликтах",
  "merge.title.cherry-pick": "Cherry-pick остановился на конфликтах",
  "merge.title.revert": "Revert остановился на конфликтах",
  "merge.title.stash": "В некоторых файлах изменения столкнулись",
  "merge.title.done": "Все конфликты решены",
  "merge.title.done@simple": "Всё решено",
  "merge.explain":
    "Оставьте одну из версий каждого файла или исправьте его вручную и отметьте решённым. Потом завершите.",
  "merge.explain@simple":
    "Ваши файлы и файлы с сервера не получилось объединить автоматически. Для каждого файла выберите, какую версию оставить. Пока вы не закончите, ничего не отправится.",
  "merge.explainStash":
    "Отложенные изменения столкнулись с более новыми. Выберите версию для каждого файла.",
  "merge.explainDone": "Завершите, чтобы закоммитить результат.",
  "merge.explainDone@simple":
    "Нажмите «Завершить», чтобы сохранить результат и отправить его на сервер.",
  "merge.left": {
    one: "Остался {count} файл",
    few: "Осталось {count} файла",
    many: "Осталось {count} файлов",
    other: "Осталось {count} файла",
  },
  "merge.abort.merge": "Отменить слияние",
  "merge.abort.rebase": "Прервать перебазирование",
  "merge.abort.cherry-pick": "Прервать cherry-pick",
  "merge.abort.revert": "Прервать revert",
  "merge.finish.merge": "Завершить",
  "merge.finish.rebase": "Продолжить",
  "merge.finish.cherry-pick": "Продолжить",
  "merge.finish.revert": "Продолжить",
  "merge.finishFirst": "Сначала выберите версию для каждого файла",
  "merge.done": "Слияние закоммичено.",
  "merge.done@simple": "Готово, файлы объединены.",
  "merge.continued": "Продолжено.",
  "merge.conflicts": "КОНФЛИКТЫ",
  "merge.conflicts@simple": "НУЖНО ВЫБРАТЬ ВЕРСИЮ",
  "merge.merged": "ОБЪЕДИНЕНО АВТОМАТИЧЕСКИ",
  "merge.merged@simple": "С СЕРВЕРА, БЕЗ КОНФЛИКТОВ",
  "merge.unsaved": "НЕ ВХОДИТ В СЛИЯНИЕ",
  "merge.unsaved@simple": "ВАШИ НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ",
  "merge.started": {
    one: "Слияние остановилось: {count} файл изменён с обеих сторон.",
    few: "Слияние остановилось: {count} файла изменены с обеих сторон.",
    many: "Слияние остановилось: {count} файлов изменены с обеих сторон.",
    other: "Слияние остановилось: {count} файла изменены с обеих сторон.",
  },
  "merge.started@simple": {
    one: "{count} файл изменили и вы, и коллеги на сервере. Выберите, какую версию оставить.",
    few: "{count} файла изменили и вы, и коллеги на сервере. Выберите, какие версии оставить.",
    many: "{count} файлов изменили и вы, и коллеги на сервере. Выберите, какие версии оставить.",
    other:
      "{count} файла изменили и вы, и коллеги на сервере. Выберите, какие версии оставить.",
  },

  "conflict.open": "Конфликт",
  "conflict.open@simple": "Выберите версию",
  "conflict.kept": "Выбрано: {side}",
  "conflict.keptDeleted": "Файл будет удалён",
  "conflict.keptManual": "Исправлено вручную",
  "conflict.title.both": "Файл изменён с обеих сторон",
  "conflict.title.both@simple": "Этот файл изменили и вы, и коллега",
  "conflict.title.deletedByMe":
    "У меня файл удалён, во входящей версии изменён",
  "conflict.title.deletedByMe@simple":
    "Вы удалили этот файл, а на сервере его изменили",
  "conflict.title.deletedByThem":
    "У меня файл изменён, во входящей версии удалён",
  "conflict.title.deletedByThem@simple":
    "На сервере этот файл удалили, а вы его изменили",
  "conflict.title.bothDeleted": "Файл удалён или перенесён с обеих сторон",
  "conflict.hint":
    "Оставьте одну из версий или исправьте файл вручную и отметьте решённым. Версия, которую вы не оставите, сохранится в истории.",
  "conflict.hint@simple":
    "Выберите, какую версию оставить. Вторая не пропадёт: она останется в истории.",
  "conflict.keepMine": "Оставить мою версию",
  "conflict.keepMine.stash": "Оставить текущую версию",
  "conflict.keepDeleted": "Оставить удалённым",
  "conflict.takeTheirs.merge": "Взять версию с сервера",
  "conflict.takeTheirs.other": "Взять входящую версию",
  "conflict.takeTheirs.stash": "Взять отложенную версию",
  "conflict.deleteTheirs.merge": "Удалить, как на сервере",
  "conflict.deleteTheirs.other": "Удалить",
  "conflict.deleteTheirs.stash": "Удалить",
  "conflict.markResolved": "Отметить решённым",
  "conflict.manualHint":
    "Правите файл сами? Отредактируйте его, уберите метки <<<<<<< и >>>>>>>, сохраните и отметьте решённым.",
  "conflict.changeMind": "Передумали? Выберите другую версию.",
  "conflict.compare.merge":
    "Ниже — что изменится, если взять версию с сервера вместо вашей.",
  "conflict.compare.other":
    "Ниже — что изменится, если взять входящую версию вместо вашей.",
  "conflict.compare.stash":
    "Ниже — что изменится, если взять отложенную версию вместо текущей.",
  "conflict.markers":
    "В файле остались метки конфликта (<<<<<<< и >>>>>>>). Уберите их, сохраните файл и попробуйте снова.",

  "smartMerge.tip":
    "Unity умеет сама объединять сцены и префабы, если вы с коллегой меняли разные объекты. Включите это для проекта — и в следующий раз такие файлы не остановят синхронизацию.",
  "smartMerge.enable": "Включить умное слияние Unity",
  "smartMerge.enabled":
    "Умное слияние Unity включено. Закоммитьте .gitattributes, чтобы оно работало у всех.",
  "smartMerge.enabled@simple":
    "Умное слияние Unity включено. Сохраните версию с файлом .gitattributes, чтобы оно работало у всех.",
  "smartMerge.noUnity":
    "Для умного слияния нужна Unity, установленная через Unity Hub, а на этом компьютере её не нашлось.",

  "lfs.hintTitle": "Арт-файлы мимо Git LFS",
  "lfs.hintTitle@simple": "Большим файлам нужно особое хранение",
  "lfs.hint": {
    one: "{count} арт-файл попадёт в репозиторий как обычный файл. Git LFS хранит такие файлы отдельно от истории, и репозиторий остаётся лёгким и быстро клонируется.",
    few: "{count} арт-файла попадут в репозиторий как обычные файлы. Git LFS хранит такие файлы отдельно от истории, и репозиторий остаётся лёгким и быстро клонируется.",
    many: "{count} арт-файлов попадут в репозиторий как обычные файлы. Git LFS хранит такие файлы отдельно от истории, и репозиторий остаётся лёгким и быстро клонируется.",
    other:
      "{count} арт-файла попадут в репозиторий как обычные файлы. Git LFS хранит такие файлы отдельно от истории, и репозиторий остаётся лёгким и быстро клонируется.",
  },
  "lfs.hint@simple": {
    one: "{count} файл с картинкой, моделью, звуком или видео попадёт в проект как обычный. От таких файлов проект быстро разрастается и долго скачивается. Rivet может один раз настроить правильное хранение больших файлов.",
    few: "{count} файла с картинками, моделями, звуком или видео попадут в проект как обычные. От таких файлов проект быстро разрастается и долго скачивается. Rivet может один раз настроить правильное хранение больших файлов.",
    many: "{count} файлов с картинками, моделями, звуком или видео попадут в проект как обычные. От таких файлов проект быстро разрастается и долго скачивается. Rivet может один раз настроить правильное хранение больших файлов.",
    other:
      "{count} файла с картинками, моделями, звуком или видео попадут в проект как обычные. От таких файлов проект быстро разрастается и долго скачивается. Rivet может один раз настроить правильное хранение больших файлов.",
  },
  "lfs.setup": "Хранить большие файлы правильно",
  "lfs.later": "Не сейчас",
  "lfs.done":
    "Большие файлы теперь идут через Git LFS. Закоммитьте .gitattributes; арт, закоммиченный раньше, будет числиться изменённым, пока следующий коммит не перенесёт его в LFS.",
  "lfs.done@simple":
    "Готово. Сохраните версию вместе с файлом .gitattributes. Картинки и модели, сохранённые раньше, тоже покажутся изменёнными: так они переезжают в новое хранилище.",
  "lfs.missingTitle": "Git LFS не установлен",
  "lfs.missingTitle@simple": "Не установлено хранение больших файлов",
  "lfs.missing":
    "Git LFS хранит арт отдельно от истории проекта. Он входит в Git for Windows: запустите установщик Git ещё раз, оставьте галочку «Git LFS» (она стоит по умолчанию) и перезапустите Rivet.",
  "lfs.missing@simple":
    "Картинки и модели лучше хранить через Git LFS — он входит в Git for Windows. Запустите установщик Git ещё раз, оставьте галочку «Git LFS» (она стоит по умолчанию) и перезапустите Rivet.",
  "lfs.download": "Скачать файлы LFS",
  "lfs.download@simple": "Скачать файлы",
  "lfs.downloading": "Скачиваю…",
  "lfs.downloaded": "Файлы LFS скачаны.",
  "lfs.downloaded@simple": "Файлы скачаны.",

  "composer.tooLarge": {
    one: "GitHub не примет {files}: файл больше 100 МБ. Храните большие файлы в Git LFS или не включайте его в коммит.",
    few: "GitHub не примет {files}: файлы больше 100 МБ. Храните большие файлы в Git LFS или не включайте их в коммит.",
    many: "GitHub не примет {files}: файлы больше 100 МБ. Храните большие файлы в Git LFS или не включайте их в коммит.",
    other:
      "GitHub не примет {files}: файлы больше 100 МБ. Храните большие файлы в Git LFS или не включайте их в коммит.",
  },
  "composer.tooLarge@simple": {
    one: "Файл {files} слишком большой (больше 100 МБ): GitHub его не примет, и синхронизация не пройдёт. Включите правильное хранение больших файлов или не включайте его в версию.",
    few: "Файлы {files} слишком большие (больше 100 МБ): GitHub их не примет, и синхронизация не пройдёт. Включите правильное хранение больших файлов или не включайте их в версию.",
    many: "Файлы {files} слишком большие (больше 100 МБ): GitHub их не примет, и синхронизация не пройдёт. Включите правильное хранение больших файлов или не включайте их в версию.",
    other:
      "Файлы {files} слишком большие (больше 100 МБ): GitHub их не примет, и синхронизация не пройдёт. Включите правильное хранение больших файлов или не включайте их в версию.",
  },
  "composer.commitAnyway": "Всё равно закоммитить",
  "composer.tooLargeTitle": "Слишком большой для GitHub",

  "op.abort-operation.title": "Отменить слияние",
  "op.abort-operation.describe":
    "Вернуть всё как было до начала. Версии, выбранные для файлов с конфликтами, забудутся.",
  "op.abort-operation.describe@simple":
    "Всё вернётся как было до синхронизации. Ваши сохранённые версии останутся, а изменения с сервера придут в следующий раз. Выбранные для файлов версии забудутся.",
  "op.abort-operation.confirm": "Прервать",
  "op.abort-operation.confirm@simple": "Отменить слияние",
  "op.abort-operation.done": "Отменено. Всё как было.",
  "op.push.tooLarge": {
    one: "{files} больше 100 МБ. GitHub не принимает такие файлы, поэтому отправка, скорее всего, не пройдёт. Большие файлы нужно класть в Git LFS ещё до коммита.",
    few: "{files} больше 100 МБ. GitHub не принимает такие файлы, поэтому отправка, скорее всего, не пройдёт. Большие файлы нужно класть в Git LFS ещё до коммита.",
    many: "{files} больше 100 МБ. GitHub не принимает такие файлы, поэтому отправка, скорее всего, не пройдёт. Большие файлы нужно класть в Git LFS ещё до коммита.",
    other:
      "{files} больше 100 МБ. GitHub не принимает такие файлы, поэтому отправка, скорее всего, не пройдёт. Большие файлы нужно класть в Git LFS ещё до коммита.",
  },
  "op.push.tooLarge@simple": {
    one: "Файл {files} слишком большой (больше 100 МБ), и GitHub его не примет. Отправка, скорее всего, не пройдёт. Попросите помощи у того, кто настраивал проект.",
    few: "Файлы {files} слишком большие (больше 100 МБ), и GitHub их не примет. Отправка, скорее всего, не пройдёт. Попросите помощи у того, кто настраивал проект.",
    many: "Файлы {files} слишком большие (больше 100 МБ), и GitHub их не примет. Отправка, скорее всего, не пройдёт. Попросите помощи у того, кто настраивал проект.",
    other:
      "Файлы {files} слишком большие (больше 100 МБ), и GitHub их не примет. Отправка, скорее всего, не пройдёт. Попросите помощи у того, кто настраивал проект.",
  },
  "top.syncMerging": "Сначала завершите или отмените слияние",
  "top.syncMerging@simple": "Сначала выберите версии для файлов с конфликтом",
  "error.localChanges":
    "Сначала закоммитьте или отложите изменения: слияние перезаписало бы {files}.",
  "error.localChanges@simple":
    "Сначала сохраните версию, потом синхронизируйте ещё раз. Тогда Rivet объединит ваши изменения с изменениями с сервера ({files}).",
  "error.localChangesSwitch":
    "Сначала закоммитьте или отложите изменения: переключение перезаписало бы {files}.",
  "error.localChangesSwitch@simple":
    "Сначала сохраните версию и попробуйте снова — иначе изменения в {files} пропадут.",
  "error.unknown":
    "Что-то пошло не так. Попробуйте ещё раз; если не получится — отправьте разработчику отчёт об ошибке (Настройки → «Скопировать отчёт об ошибке»).",
  "error.offline":
    "Не получилось связаться с сервером. Проверьте, что интернет работает, и попробуйте ещё раз.",
  "error.timeout":
    "Сервер слишком долго не отвечал. Возможно, интернет медленный или нестабильный — попробуйте ещё раз через минуту.",
  "error.connectionLost":
    "Связь оборвалась на полпути. Ничего не потерялось — попробуйте ещё раз. Если с большими файлами это повторяется, возможно, интернет нестабилен.",
  "error.certificate":
    "Не удалось проверить сертификат сервера (SSL certificate problem). Обычно так бывает из-за антивируса или корпоративной сети.",
  "error.certificate@simple":
    "Rivet не смог убедиться, что соединение с сервером безопасно. Возможно, мешает антивирус или настройки сети. Попросите помощи у того, кто настраивал проект.",
  "error.auth":
    "Сервер не принял вход: пароль или токен неверный либо устарел. Войдите заново.",
  "error.auth@simple":
    "Сервер вас не узнал — скорее всего, вход устарел. Войдите в GitHub ещё раз.",
  "error.authPrompt":
    "Сервер просит войти, а сохранённого входа для него нет. Войдите в GitHub в Rivet или один раз войдите через Git Credential Manager для этого сервера.",
  "error.authPrompt@simple":
    "Сервер просит войти. Войдите в GitHub и попробуйте ещё раз.",
  "error.sshKey":
    "Сервер не принял SSH-ключ этого компьютера (Permission denied (publickey)). Добавьте ключ в свой аккаунт или используйте HTTPS-ссылку.",
  "error.sshKey@simple":
    "Этот проект подключён способом, для которого компьютер нужно дополнительно настроить. Попросите помощи у того, кто настраивал проект.",
  "error.sshHost":
    "SSH ещё не знает этот сервер (host key verification failed). Подключитесь к нему один раз из терминала, например ssh -T git@github.com, или используйте HTTPS-ссылку.",
  "error.sshHost@simple":
    "Этот проект подключён способом, для которого компьютер нужно дополнительно настроить. Попросите помощи у того, кто настраивал проект.",
  "error.noAccess":
    "У вашего аккаунта нет прав на изменение этого репозитория. Попросите владельца дать доступ на запись.",
  "error.noAccess@simple":
    "Вашему аккаунту нельзя отправлять изменения в этот проект. Попросите владельца проекта добавить вас.",
  "error.notFound":
    "По этому адресу нет репозитория, или ваш аккаунт его не видит. Проверьте ссылку или войдите под аккаунтом, у которого есть доступ.",
  "error.notFound@simple":
    "По этому адресу нет проекта, или ваш аккаунт его не видит. Проверьте ссылку или войдите в аккаунт, у которого есть доступ.",
  "error.noRemote":
    "Этот репозиторий не связан с сервером (нет удалённого репозитория origin).",
  "error.noRemote@simple":
    "Этот проект ещё не связан с сервером, поэтому отправлять его некуда.",
  "error.pushRejected":
    "На сервере есть коммиты, которых у вас ещё нет, поэтому он не принял отправку. Сначала получите изменения, потом отправьте снова.",
  "error.pushRejected@simple":
    "Пока вы работали, кто-то отправил на сервер свои изменения. Нажмите «Синхронизировать»: Rivet сначала заберёт их, а потом отправит ваши.",
  "error.protectedBranch":
    "Эта ветка защищена на сервере: изменения принимаются только через пул-реквесты. Отправьте их в новую ветку и откройте пул-реквест.",
  "error.protectedBranch@simple":
    "Сервер не разрешает отправлять изменения прямо в этот проект. Попросите помощи у того, кто настраивал проект.",
  "error.tooLarge":
    "GitHub не принимает файлы больше 100 МБ: {files}. Отмените коммит, добавьте файл в Git LFS и закоммитьте снова.",
  "error.tooLarge@simple":
    "GitHub не принимает файлы больше 100 МБ: {files}. Для больших файлов нужно особое хранилище. Попросите помощи у того, кто настраивал проект.",
  "error.tooLargeAny":
    "GitHub не принял файл больше 100 МБ. Отмените коммит, добавьте файл в Git LFS и закоммитьте снова.",
  "error.tooLargeAny@simple":
    "GitHub не принимает файлы больше 100 МБ, а в этой версии такой есть. Попросите помощи у того, кто настраивал проект.",
  "error.locked":
    "С этим репозиторием сейчас работает другая программа (есть файл .git/index.lock). Подождите немного и попробуйте снова. Если других Git-программ не запущено, удалите этот файл.",
  "error.locked@simple":
    "С этим проектом сейчас работает другая программа. Подождите немного и попробуйте ещё раз.",
  "error.fileBusy":
    "Файл {file} сейчас занят другой программой — чаще всего Unity. Закройте Unity (или программу, где открыт файл) и попробуйте снова.",
  "error.filesBusy":
    "Один из файлов проекта сейчас занят другой программой — чаще всего Unity. Закройте Unity и попробуйте снова.",
  "error.noPermission":
    "Rivet не может записывать в эту папку. Выберите другую, например в «Документах» или на диске D.",
  "error.diskFull":
    "На диске закончилось место. Освободите немного (очистите корзину, удалите старые сборки) и попробуйте снова.",
  "error.pathTooLong":
    "Некоторые пути к файлам слишком длинные для Windows. Перенесите проект в папку с коротким путём, например D:\\Projects, или включите длинные пути: git config --global core.longpaths true.",
  "error.pathTooLong@simple":
    "Некоторые пути к файлам в этом проекте слишком длинные для Windows. Выберите папку с коротким путём, например D:\\Projects, и попробуйте снова.",
  "error.lfsFilter":
    "Git LFS не смог скачать или сохранить большой файл. Попробуйте ещё раз; если не поможет, возможно, файла нет на сервере — попросите того, кто его закоммитил, отправить его снова.",
  "error.lfsFilter@simple":
    "Не получилось скачать или сохранить большой файл. Попробуйте ещё раз; если не поможет, попросите помощи у того, кто настраивал проект.",
  "error.notRepository":
    "Эта папка (больше) не Git-репозиторий. Возможно, папку .git удалили или проект перенесли.",
  "error.notRepository@simple":
    "Rivet больше не находит в этой папке историю проекта. Возможно, проект перенесли или заменили.",
  "error.folderMissing":
    "Папки проекта больше нет на месте. Возможно, её переместили, переименовали или удалили, либо она на диске, который сейчас не подключён.",
  "error.gitMissing":
    "На компьютере не установлен Git. Установите Git для Windows и попробуйте снова.",
  "error.identity": "Чтобы подписывать коммиты, Git нужны ваши имя и почта.",
  "error.identity@simple":
    "Чтобы сохранять версии, нужно указать, как их подписывать.",
  "error.dubiousOwnership":
    "Git не открывает этот репозиторий: папка принадлежит другому пользователю Windows (так бывает на внешних дисках). Если папка ваша, добавьте её в доверенные.",
  "error.dubiousOwnership@simple":
    "Windows считает, что эта папка принадлежит другому пользователю, поэтому проект не открывается (так бывает на внешних дисках). Если проект ваш, нажмите «Доверять этой папке».",
  "error.destinationExists":
    "Там уже есть папка {name}, и она не пустая. Выберите другое место или переименуйте ту папку.",
  "error.unrelatedHistories":
    "У истории на сервере и вашей нет ничего общего, поэтому их нельзя слить. Проверьте, что проект связан с нужным репозиторием.",
  "error.unrelatedHistories@simple":
    "На сервере какой-то другой проект, не ваш. Попросите помощи у того, кто настраивал проект.",
  "error.noRemoteBranch":
    "Этой ветки (больше) нет на сервере — возможно, её там удалили. Отправьте её снова или переключитесь на другую.",
  "error.noRemoteBranch@simple":
    "На сервере больше нет работы этого проекта. Попросите помощи у того, кто настраивал проект.",
  "error.detached":
    "Сейчас вы не на ветке (detached HEAD), поэтому отправлять нечего. Создайте здесь ветку или переключитесь на существующую.",
  "error.detached@simple":
    "Сейчас открыта одна из прошлых версий проекта, поэтому отправлять нечего. Попросите помощи у того, кто настраивал проект.",
  "error.nothingToCommit": "Коммитить нечего.",
  "error.nothingToCommit@simple": "Нет изменений, которые можно сохранить.",
  "error.details": "Подробнее",
  "error.hideDetails": "Скрыть подробности",
  "error.action.retry": "Попробовать снова",
  "error.action.sync": "Получить изменения…",
  "error.action.sync@simple": "Синхронизировать",
  "error.action.signIn": "Войти в GitHub",
  "error.action.identity": "Указать имя и почту",
  "error.action.installGit": "Скачать Git",
  "error.action.trust": "Доверять этой папке",
  "error.trusted": "Готово: Git теперь доверяет папке {path}.",
  "error.trusted@simple": "Готово, теперь проект можно открыть.",

  "health.eyebrow": "ПРЕЖДЕ ЧЕМ НАЧАТЬ",
  "health.missing.title": "Для работы Rivet нужен Git",
  "health.missing.text":
    "Git — бесплатная программа, которая хранит версии ваших файлов; Rivet работает поверх неё. Установите Git для Windows: скачайте установщик, запустите его и нажимайте «Next» — настройки по умолчанию подходят.",
  "health.old.title": "Git нужно обновить",
  "health.old.text":
    "На компьютере установлен Git {version}, а Rivet нужна версия {required} или новее. Скачайте свежую версию и установите поверх старой — проекты и настройки останутся как были.",
  "health.download": "Скачать Git для Windows",
  "health.recheck": "Проверить снова",
  "health.checking": "Проверяю…",
  "health.stillMissing":
    "Пока не нашёлся. Если установка ещё идёт, дождитесь её окончания и проверьте снова.",

  "identity.eyebrow": "ОСТАЛОСЬ ОДНО",
  "identity.title": "Имя и почта для коммитов",
  "identity.title@simple": "Как подписывать ваши версии?",
  "identity.text":
    "Git подписывает каждый коммит именем и почтой. Rivet сохранит их в глобальных настройках Git (user.name и user.email).",
  "identity.text@simple":
    "Каждая сохранённая версия подписывается именем и почтой — так команда видит, кто что сделал.",
  "identity.name": "Имя",
  "identity.email": "Почта",
  "identity.namePlaceholder": "Анна Иванова",
  "identity.githubHint":
    "Это скрытый адрес GitHub: коммиты будут связаны с вашим аккаунтом, а настоящая почта останется скрытой.",
  "identity.githubHint@simple":
    "Это скрытый адрес GitHub: версии будут связаны с вашим аккаунтом, а настоящая почта останется скрытой.",
  "identity.publicHint": "Этот адрес увидят все, у кого есть доступ к проекту.",
  "identity.fromGitHub": "Взять из GitHub",
  "identity.useGitHub": "Подставить скрытый адрес GitHub",
  "identity.save": "Сохранить",
  "identity.later": "Позже",
  "identity.saved": "Сохранено. Коммиты будут подписаны: {name} <{email}>.",
  "identity.saved@simple": "Готово. Ваши версии будут подписаны: {name}.",
  "identity.error.name": "Укажите имя.",
  "identity.error.email": "Укажите почту, например name@example.com.",

  "settings.identity": "Имя и почта для коммитов",
  "settings.identity@simple": "Подпись ваших версий",
  "settings.identityNone": "Пока не указана",
  "settings.identityEdit": "Изменить",
  "settings.help": "Помощь",
  "settings.report": "Скопировать отчёт об ошибке",
  "settings.reportHint":
    "Если что-то не работает, скопируйте отчёт и отправьте разработчику. В нём версии Rivet, Windows и Git и последние записи журнала, без паролей.",
  "settings.reportCopied":
    "Отчёт скопирован. Вставьте его в сообщение разработчику.",

  "crash.title": "Что-то сломалось",
  "crash.text":
    "Rivet столкнулся с неожиданной проблемой. Ваши файлы в порядке. Перезагрузите окно; если это повторится, скопируйте отчёт об ошибке и отправьте разработчику.",
  "crash.reload": "Перезагрузить",

  "settings.project": "Этот проект",
  "settings.lfs": "Большие файлы (Git LFS)",
  "settings.on": "Включено",
  "settings.smartMerge": "Умное слияние Unity",
  "settings.smartMergeHint":
    "Unity сама объединяет сцены, префабы и материалы, если люди меняли разные объекты. Работает через UnityYAMLMerge из Unity {version}.",
  "settings.turnOn": "Включить",
};
