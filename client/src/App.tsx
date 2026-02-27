import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Estoque from "./pages/Estoque";
import Compras from "./pages/Compras";
import Medicoes from "./pages/Medicoes";
import Vendas from "./pages/Vendas";
import Relatorios from "./pages/Relatorios";
import Alertas from "./pages/Alertas";
import Postos from "./pages/Postos";
import Configuracoes from "./pages/Configuracoes";
import DRE from "./pages/DRE";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import InicializacaoMensal from "./pages/InicializacaoMensal";
import RecalcularCMV from "./pages/RecalcularCMV";
import AssistenteIA from "./pages/AssistenteIA";
import AlocacoesFisicas from "./pages/AlocacoesFisicas";
import AlocacoesNFe from "./pages/AlocacoesNFe";
import Reconciliacao from "./pages/Reconciliacao";
import CoerenciaFisica from "./pages/CoerenciaFisica";
import Transferencias from "./pages/Transferencias";
import BloqueioDRE from "./pages/BloqueioDRE";
import PendenciasEstoque from "./pages/PendenciasEstoque";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/estoque"} component={Estoque} />
      <Route path={"/compras"} component={Compras} />
      <Route path={"/medicoes"} component={Medicoes} />
      <Route path={"/vendas"} component={Vendas} />
      <Route path={"/relatorios"} component={Relatorios} />
      <Route path={"/alertas"} component={Alertas} />
      <Route path={"/postos"} component={Postos} />
      <Route path={"/configuracoes"} component={Configuracoes} />
      <Route path={"/dre"} component={DRE} />
      <Route path={"/usuarios"} component={GestaoUsuarios} />
      <Route path={"/inicializacao-mensal"} component={InicializacaoMensal} />
      <Route path={"/recalcular-cmv"} component={RecalcularCMV} />
      <Route path={"/assistente-ia"} component={AssistenteIA} />
      <Route path={"/alocacoes-fisicas"} component={AlocacoesFisicas} />
      <Route path={"/alocacoes-nfe"} component={AlocacoesNFe} />
      <Route path={"/reconciliacao"} component={Reconciliacao} />
      <Route path={"/pendencias-estoque"} component={PendenciasEstoque} />
      <Route path={"/coerencia-fisica"} component={CoerenciaFisica} />
      <Route path={"/transferencias"} component={Transferencias} />
      <Route path={"/bloqueio-dre"} component={BloqueioDRE} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
