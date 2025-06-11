# Базовый образ Node.js
FROM node:18

# Установка рабочей директории
WORKDIR /app

# Копирование файлов package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm install

# Копирование всех файлов проекта в контейнер
COPY . .

# Открытие порта, на котором работает Vite (по умолчанию 5173)
EXPOSE 5173

# Команда запуска в режиме разработки
CMD ["npm", "run", "dev", "--", "--host"]
