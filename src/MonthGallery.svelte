<script>
  export let month = '';
  export let images = [];
</script>

<div class="month-gallery">
  <h3>{month}</h3>
  <div class="images-grid">
    {#each images as img}
      <img src={img.src} alt="Uploaded image" />
    {/each}
  </div>
</div>

<style>
  .month-gallery {
    margin-bottom: 2rem;
    border: 1px solid #ddd;
    padding: 0.5rem;
    border-radius: 4px;
  }
  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }
  img {
    width: 100%;
    height: auto;
    object-fit: cover;
  }
</style>
