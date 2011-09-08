class MapsController < ApplicationController
  respond_to :html, :json
  before_filter :authenticate_user!

  def index
    @maps = current_user.maps.all
    respond_with(@maps)
  end

  def show
    @map = Map.find(params[:id])
    ActiveRecord::Base.include_root_in_json = false
    @map_json = @map.to_json(:include => :memories)

    respond_with(@map) do |format|
      format.html do
        @years = @map.memories.collect {|m| m.date.year}.uniq
        @map_json = @map_json.html_safe
      end
      format.json do |format|
        render :json => @map_json
      end
    end
  end

  def new
    @map = Map.new
  end

  def create
    @map = Map.new(params[:map])
    @map.user = current_user

    respond_to do |format|
      if @map.save
        format.html { redirect_to(@map,
                      :notice => 'Map was successfully created.') }
      else
        format.html{ render :action => "new" }
      end
    end
  end

  def edit
  end

  def update
  end

  def destroy
  end
end
