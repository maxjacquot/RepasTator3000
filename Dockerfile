# Version web de Maisontator : export web de l'appli Expo + back (api/), sur maison.mjacquot.fr.

# --- Étape 1 : export web de l'appli Expo ---
FROM node:24 AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export -p web --output-dir dist

# --- Étape 2 : le back sert l'appli web et l'API (aucune dépendance npm) ---
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/serveur.js ./api/
COPY --from=web /app/dist ./dist
# Ne pas tourner en root dans le conteneur
USER node
EXPOSE 3000
CMD ["node", "api/serveur.js"]
