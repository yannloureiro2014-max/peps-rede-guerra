import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sincronizarMedicoesACS, sincronizarVendasACS } from "../etl-acs";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Sincronização automática a cada 60 minutos
    const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 60 minutos
    let syncRunning = false;
    
    async function autoSync() {
      if (syncRunning) {
        console.log("[AUTO-SYNC] Sincronização anterior ainda em andamento, pulando...");
        return;
      }
      syncRunning = true;
      try {
        console.log("[AUTO-SYNC] Iniciando sincronização automática...");
        
        // 1. Sincronizar vendas (abastecimentos) - últimos 3 dias
        console.log("[AUTO-SYNC] Etapa 1/2: Sincronizando vendas...");
        const vendasResult = await sincronizarVendasACS(3);
        console.log(`[AUTO-SYNC] Vendas: ${vendasResult.success ? 'SUCESSO' : 'COM ERROS'} (${vendasResult.inseridos || 0} inseridas)`);
        
        // 2. Sincronizar medições - últimos 7 dias
        console.log("[AUTO-SYNC] Etapa 2/2: Sincronizando medições...");
        const medicoesResult = await sincronizarMedicoesACS(7);
        console.log(`[AUTO-SYNC] Medições: ${medicoesResult.success ? 'SUCESSO' : 'COM ERROS'}`);
        
        console.log(`[AUTO-SYNC] Concluída: vendas=${vendasResult.success ? 'OK' : 'ERRO'}, medições=${medicoesResult.success ? 'OK' : 'ERRO'}`);
      } catch (error) {
        console.error("[AUTO-SYNC] Erro na sincronização automática:", error);
      } finally {
        syncRunning = false;
      }
    }
    
    // Primeira sincronização 2 minutos após iniciar o servidor
    setTimeout(autoSync, 2 * 60 * 1000);
    // Depois a cada 60 minutos
    setInterval(autoSync, SYNC_INTERVAL_MS);
    console.log(`[AUTO-SYNC] Sincronização automática configurada: a cada ${SYNC_INTERVAL_MS / 60000} minutos`);
  });
}

startServer().catch(console.error);
