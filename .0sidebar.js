let appSidebar = `
    <nav>



    

    <div class="sidebar">
                
    <h3 class="sidebar-title">Articles</h3>
    <strong class="sidebar-subtitle">Edukasi Asuransi</strong>
    
    <div class="sidebar-item categories">
        <ul id="sidebar-nav">
            
            <li>
                <a class="collapsed" data-bs-target="#nav1" data-bs-toggle="collapse">
                    <i class="bi bi-grid"></i>
                    Terminologi
                    <i class="bi bi-chevron-down ms-auto"></i>
                </a>
                <ul id="nav1" class="nav-content collapse " data-bs-parent="#sidebar-nav">
                    <li>
                      <a href="tables-general.html">
                        <i class="bi bi-circle"></i><span>General Tables</span>
                      </a>
                    </li>
                    <li>
                      <a href="tables-data.html">
                        <i class="bi bi-circle"></i><span>Data Tables</span>
                      </a>
                    </li>
                  </ul>
            </li>
            
            <li>
                <a class="collapsed" data-bs-target="#nav2" data-bs-toggle="collapse">
                    <i class="bi bi-grid"></i>
                    Pengantar
                    <i class="bi bi-chevron-down ms-auto"></i>
                </a>
                <ul id="nav2" class="nav-content collapse " data-bs-parent="#sidebar-nav">
                    <li>
                      <a href="tables-general.html">
                        <i class="bi bi-circle"></i><span>General Tables</span>
                      </a>
                    </li>
                    <li>
                      <a href="tables-data.html">
                        <i class="bi bi-circle"></i><span>Data Tables</span>
                      </a>
                    </li>
                  </ul>
            </li>
            
            <li>
                <a class="collapsed" href="get-quote">
                    <i class="bi bi-person"></i>
                    <span>Get Quote</span>
                </a>
            </li>
            
        </ul>
    </div><!-- End sidebar categories-->
    
</div><!-- End sidebar -->





    </nav>
`;
document.getElementById("app-sidebar").innerHTML = appSidebar;