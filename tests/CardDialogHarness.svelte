<script lang="ts">
  import { CardDialog } from '../src/index'
  let { onclose = () => {} }: { onclose?: () => void } = $props()
</script>

<CardDialog {onclose}>
  <p>card</p>
</CardDialog>
