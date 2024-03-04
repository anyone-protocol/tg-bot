# Use the official Node.js 16 as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Install any needed packages specified in package.json
RUN npm install

# Make port 80 available to the world outside this container
EXPOSE 80

# Define environment variable
ENV API_URL=https://onionoo.torproject.org/details

ENV BOT_TOKEN=

# Run bot when the container launches
CMD ["node", "index.js"]
