# Используем официальный образ Node.js на Alpine (легковесный)
FROM node:20-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY vite.config.js ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Собираем проект
RUN npm run build

# Порт, который будет использоваться
EXPOSE 3000

# Команда для запуска сервера разработки (или production)
CMD ["npm", "run", "dev"]