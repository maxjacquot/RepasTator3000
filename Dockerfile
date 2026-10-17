# RepasTator (repas.mjacquot.fr) : le back (api/) sert le site (public/) et les données. Aucune dépendance npm,
# aucune étape de construction : les fichiers de public/ sont servis tels quels.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/serveur.js ./api/
COPY public ./public
# Ne pas tourner en root dans le conteneur
USER node
EXPOSE 3000
CMD ["node", "api/serveur.js"]
