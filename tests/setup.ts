// Os testes conferem o texto em português; o jsdom diz que o navegador é inglês. Cada arquivo começa em português
// (os testes de inglês trocam e voltam).
import { setLocale } from '../src/i18n.svelte'

setLocale('pt-BR')
